import crypto from "node:crypto";

import { buildLoginRequiredPayload, getBusinessAccessContext } from "@/lib/business-access";
import { sanitizeNextPath } from "@/lib/auth";
import { json } from "@/lib/http";
import { updateBusiness } from "@/lib/repository";
import { createCheckoutSession, hasStripeConfig } from "@/lib/stripe";
import type { BillingInterval, PlanId } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      businessId?: string;
      plan?: PlanId;
      billingInterval?: BillingInterval;
      next?: string;
    };

    if (!body.businessId || !body.plan || !body.billingInterval) {
      return json(
        { error: "businessId, plan, and billingInterval are required." },
        { status: 400 }
      );
    }

    const access = await getBusinessAccessContext(body.businessId);
    if (!access.business) {
      return json({ error: "Business not found." }, { status: 404 });
    }

    if (!access.isOwner) {
      return json(
        buildLoginRequiredPayload({
          businessId: body.businessId,
          next: sanitizeNextPath(body.next || `/agent/${body.businessId}/deploy`),
          intent: "deploy"
        }),
        { status: 401 }
      );
    }

    const nextPath = sanitizeNextPath(body.next || `/agent/${body.businessId}/deploy`);

    if (!hasStripeConfig()) {
      await updateBusiness(body.businessId, {
        plan: body.plan,
        billingInterval: body.billingInterval,
        status: access.business.isDeployed ? "live" : "active",
        subscriptionStatus: "active",
        stripeSubscriptionId: `dev_sub_${crypto.randomUUID()}`
      });

      return json({
        checkoutUrl: nextPath
      });
    }

    await updateBusiness(body.businessId, {
      plan: body.plan,
      billingInterval: body.billingInterval,
      subscriptionStatus: "pending"
    });

    const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
    const session = await createCheckoutSession({
      business: access.business,
      plan: body.plan,
      billingInterval: body.billingInterval,
      origin,
      nextPath
    });

    return json({
      checkoutUrl: session.url
    });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 500 }
    );
  }
}
