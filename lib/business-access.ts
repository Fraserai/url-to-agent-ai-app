import { cookies } from "next/headers";

import { buildLoginPath, getCurrentAppUser, hasDraftAccess } from "@/lib/auth";
import { getBusiness } from "@/lib/repository";
import type { AppUser, BusinessRecord } from "@/lib/types";

type CookieReader = ReturnType<typeof cookies>;

export async function getBusinessAccessContext(
  businessId: string,
  cookieReader?: CookieReader,
  user?: AppUser | null
) {
  const business = await getBusiness(businessId);
  const reader = cookieReader ?? cookies();
  const currentUser = user ?? (await getCurrentAppUser(reader));

  if (!business) {
    return {
      business: null,
      user: currentUser,
      isOwner: false,
      hasDraftToken: false
    };
  }

  const isOwner = Boolean(currentUser && business.userId === currentUser.id);
  const hasDraftToken = hasDraftAccess(reader, business);

  return {
    business,
    user: currentUser,
    isOwner,
    hasDraftToken
  };
}

export function canViewBusiness(access: {
  business: BusinessRecord | null;
  isOwner: boolean;
  hasDraftToken: boolean;
}) {
  if (!access.business) return false;
  return access.isOwner || access.hasDraftToken;
}

export function canDeployBusiness(access: {
  business: BusinessRecord | null;
  isOwner: boolean;
}) {
  if (!access.business) return false;
  return access.isOwner;
}

export function hasActiveSubscription(business: BusinessRecord) {
  if (!business.plan) return false;
  if (business.status === "draft" || business.status === "suspended") return false;
  if (business.subscriptionStatus === "active") return true;
  return !process.env.STRIPE_SECRET_KEY && business.status === "active";
}

export function buildLoginRequiredPayload(input: {
  businessId: string;
  next: string;
  intent: "save" | "deploy" | "dashboard";
}) {
  return {
    loginRequired: true,
    loginUrl: buildLoginPath({
      next: input.next,
      draftId: input.businessId,
      intent: input.intent
    })
  };
}
