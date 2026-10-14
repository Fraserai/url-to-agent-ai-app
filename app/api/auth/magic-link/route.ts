import { NextResponse } from "next/server";

import {
  buildLocalDevUser,
  clearDraftAccessCookieHeader,
  sanitizeNextPath,
  serializeLocalAuthCookie
} from "@/lib/auth";
import { claimDraftBusiness } from "@/lib/repository";
import { json } from "@/lib/http";
import { hasSupabaseBrowserConfig } from "@/lib/supabase";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      email?: string;
      next?: string;
      draftId?: string;
    };
    const email = body.email?.trim();

    if (!email) {
      return json({ error: "Email is required." }, { status: 400 });
    }

    const nextPath = sanitizeNextPath(body.next);
    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;

    if (!hasSupabaseBrowserConfig()) {
      const user = buildLocalDevUser(email);
      const response = json({
        message: `Signed in locally as ${email} for development.`,
        redirectTo: nextPath
      });

      response.cookies.set(serializeLocalAuthCookie(user));

      if (body.draftId) {
        await claimDraftBusiness(body.draftId, user.id, user.email);
        response.cookies.set(clearDraftAccessCookieHeader(body.draftId));
      }

      return response;
    }

    const redirectParams = new URLSearchParams({
      next: nextPath
    });

    if (body.draftId) {
      redirectParams.set("draftId", body.draftId);
    }

    const redirectTo = `${origin}/auth/callback?${redirectParams.toString()}`;
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL}/auth/v1/otp`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "",
          Authorization: `Bearer ${
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ""
          }`
        },
        body: JSON.stringify({
          email,
          create_user: true,
          options: {
            emailRedirectTo: redirectTo
          }
        })
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(details || "Supabase rejected the magic link request.");
    }

    return NextResponse.json({
      message: `If an account exists for ${email}, a magic link is on the way.`
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to send the magic link." },
      { status: 500 }
    );
  }
}
