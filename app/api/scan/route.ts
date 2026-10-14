import { createDraftAccessToken, getCurrentAppUser, getDraftCookieName } from "@/lib/auth";
import { scanBusinessWebsite } from "@/lib/business";
import { json } from "@/lib/http";
import { createBusiness } from "@/lib/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { url?: string };

    if (!body.url?.trim()) {
      return json({ error: "A website URL is required." }, { status: 400 });
    }

    const scanned = await scanBusinessWebsite(body.url);

    const currentUser = await getCurrentAppUser();

    const draftAccess = currentUser ? null : createDraftAccessToken();
    const business = await createBusiness({
      ...scanned,
      status: currentUser ? "active" : "draft",
      userId: currentUser?.id ?? null,
      draftTokenHash: draftAccess?.hash ?? null,
      draftExpiresAt: draftAccess?.expiresAt ?? null,
      claimedAt: currentUser ? new Date().toISOString() : null
    });

    const response = json({ business });

    if (draftAccess) {
      response.cookies.set({
        name: getDraftCookieName(business.id),
        value: draftAccess.token,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 7
      });
    }

    return response;
  } catch (error) {
    return json(
      {
        error: error instanceof Error ? error.message : "Unable to scan the website."
      },
      { status: 500 }
    );
  }
}
