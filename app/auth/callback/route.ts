import { NextResponse } from "next/server";

import { clearDraftAccessCookieHeader, sanitizeNextPath } from "@/lib/auth";
import { claimDraftBusiness } from "@/lib/repository";
import { getSupabaseRouteHandlerClient, hasSupabaseBrowserConfig } from "@/lib/supabase";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const nextPath = sanitizeNextPath(url.searchParams.get("next"));
  const draftId = url.searchParams.get("draftId");
  const origin = url.origin;

  if (!hasSupabaseBrowserConfig()) {
    return NextResponse.redirect(new URL(nextPath, origin));
  }

  const redirectResponse = NextResponse.redirect(new URL(nextPath, origin));
  const { supabase, response } = getSupabaseRouteHandlerClient(redirectResponse);

  if (!supabase) {
    return redirectResponse;
  }

  const code = url.searchParams.get("code");
  const errorDescription = url.searchParams.get("error_description");

  if (errorDescription) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(errorDescription)}`, origin)
    );
  }

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (user && draftId) {
    await claimDraftBusiness(draftId, user.id, user.email ?? null);
    response.cookies.set(clearDraftAccessCookieHeader(draftId));
  }

  return response;
}
