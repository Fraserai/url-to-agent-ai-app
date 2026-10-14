import crypto from "node:crypto";

import { cookies } from "next/headers";

import { getSupabaseServerClient, hasSupabaseBrowserConfig } from "@/lib/supabase";
import type { AppUser, BusinessRecord } from "@/lib/types";

export const LOCAL_AUTH_COOKIE = "agentdrop_local_user";
export const DRAFT_COOKIE_PREFIX = "agentdrop_draft_";
export const DRAFT_TTL_SECONDS = 60 * 60 * 24 * 7;

type CookieReader = {
  get: (name: string) => { value: string } | undefined;
  getAll?: () => Array<{ name: string; value: string }>;
};

function encodeLocalUser(user: AppUser) {
  return Buffer.from(JSON.stringify(user), "utf8").toString("base64url");
}

function decodeLocalUser(value: string | undefined) {
  if (!value) return null;

  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as AppUser;
  } catch {
    return null;
  }
}

export function buildLocalDevUser(email: string): AppUser {
  const normalizedEmail = email.trim().toLowerCase();
  return {
    id: crypto.createHash("sha256").update(normalizedEmail).digest("hex").slice(0, 32),
    email: normalizedEmail,
    provider: "local"
  };
}

export function getDraftCookieName(businessId: string) {
  return `${DRAFT_COOKIE_PREFIX}${businessId}`;
}

export function hashOpaqueToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function createDraftAccessToken() {
  const token = crypto.randomBytes(32).toString("hex");
  const hash = hashOpaqueToken(token);
  const expiresAt = new Date(Date.now() + DRAFT_TTL_SECONDS * 1000).toISOString();

  return {
    token,
    hash,
    expiresAt
  };
}

export function getDraftTokenFromCookies(reader: CookieReader, businessId: string) {
  return reader.get(getDraftCookieName(businessId))?.value ?? null;
}

export function hasDraftAccess(reader: CookieReader, business: BusinessRecord) {
  if (!business.draftTokenHash || !business.draftExpiresAt || business.userId) {
    return false;
  }

  if (new Date(business.draftExpiresAt).getTime() < Date.now()) {
    return false;
  }

  const token = getDraftTokenFromCookies(reader, business.id);
  if (!token) return false;

  return hashOpaqueToken(token) === business.draftTokenHash;
}

export function clearDraftAccessCookieHeader(businessId: string) {
  return {
    name: getDraftCookieName(businessId),
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    }
  };
}

export function getLocalAuthUserFromCookies(reader: CookieReader) {
  const cookie = reader.get(LOCAL_AUTH_COOKIE)?.value;
  return decodeLocalUser(cookie);
}

export async function getCurrentAppUser(reader?: CookieReader): Promise<AppUser | null> {
  const cookieReader = reader ?? cookies();
  const localUser = getLocalAuthUserFromCookies(cookieReader);
  if (localUser) {
    return localUser;
  }

  if (!hasSupabaseBrowserConfig()) {
    return null;
  }

  const supabase = getSupabaseServerClient();
  if (!supabase) return null;

  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  return {
    id: user.id,
    email: user.email ?? null,
    provider: "supabase"
  };
}

export function serializeLocalAuthCookie(user: AppUser) {
  return {
    name: LOCAL_AUTH_COOKIE,
    value: encodeLocalUser(user),
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 30
    }
  };
}

export function clearLocalAuthCookieHeader() {
  return {
    name: LOCAL_AUTH_COOKIE,
    value: "",
    options: {
      httpOnly: true,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 0
    }
  };
}

export function sanitizeNextPath(nextPath: string | null | undefined) {
  if (!nextPath) return "/dashboard";
  if (!nextPath.startsWith("/")) return "/dashboard";
  if (nextPath.startsWith("//")) return "/dashboard";
  return nextPath;
}

export function buildLoginPath(input?: {
  next?: string;
  draftId?: string;
  intent?: "save" | "deploy" | "dashboard";
}) {
  const searchParams = new URLSearchParams();

  if (input?.next) {
    searchParams.set("next", sanitizeNextPath(input.next));
  }

  if (input?.draftId) {
    searchParams.set("draftId", input.draftId);
  }

  if (input?.intent) {
    searchParams.set("intent", input.intent);
  }

  const query = searchParams.toString();
  return query ? `/login?${query}` : "/login";
}

