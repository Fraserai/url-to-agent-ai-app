import type Stripe from "stripe";

import { json } from "@/lib/http";
import { findBusinessByStripeSubscriptionId, getBusiness, updateBusiness } from "@/lib/repository";
import { constructStripeEvent, hasStripeConfig } from "@/lib/stripe";
import type { BillingInterval, PlanId } from "@/lib/types";

type StripeSessionLike = {
  metadata?: Record<string, string | undefined> | null;
  subscription?: string | { id?: string | null } | null;
  customer?: string | { id?: string | null } | null;
};

function getNestedId(value: unknown) {
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    const id = (value as { id?: unknown }).id;
    return typeof id === "string" ? id : null;
  }

  return null;
}

function getSubscriptionDetailsFromSession(session: StripeSessionLike) {
  const plan = session.metadata?.plan as PlanId | undefined;
  const billingInterval = session.metadata?.billingInterval as BillingInterval | undefined;
  const businessId = session.metadata?.businessId;
  const subscriptionId = getNestedId(session.subscription);
  const customerId = getNestedId(session.customer);

  return {
    businessId,
    plan,
    billingInterval,
    subscriptionId,
    customerId
  };
}

function getSubscriptionIdFromInvoice(invoice: Stripe.Invoice) {
  const rawInvoice = invoice as Stripe.Invoice & {
    subscription?: string | { id?: string | null } | null;
  };

  return getNestedId(rawInvoice.subscription);
}

function getSubscriptionIdFromEventObject(object: Stripe.Invoice | Stripe.Subscription) {
  const subscriptionId = getNestedId(
    (object as Stripe.Invoice & {
      subscription?: string | { id?: string | null } | null;
    }).subscription
  );

  if (subscriptionId) {
    return subscriptionId;
  }

  return "id" in object && typeof object.id === "string" ? object.id : null;
}

function getSessionFromEventObject(object: unknown) {
  return object as StripeSessionLike;
}

function getInvoiceFromEventObject(object: unknown) {
  return object as Stripe.Invoice;
}

function getSubscriptionLikeFromEventObject(object: unknown) {
  return object as Stripe.Invoice | Stripe.Subscription;
}

function buildSessionDetailsFromEventObject(object: unknown) {
  const session = getSessionFromEventObject(object);
  return {
    session,
    details: getSubscriptionDetailsFromSession(session)
  };
}

export async function POST(request: Request) {
  const payload = await request.text();

  if (!hasStripeConfig() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return json({
      received: false,
      message:
        "Stripe webhook handling is scaffolded but inactive until STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET are configured."
    });
  }

  try {
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      return json({ error: "Missing Stripe signature." }, { status: 400 });
    }

    const event = constructStripeEvent(payload, signature);

    switch (event.type) {
      case "checkout.session.completed": {
        const { details } = buildSessionDetailsFromEventObject(event.data.object);
        const { businessId, plan, billingInterval, subscriptionId, customerId } = details;

        if (businessId) {
          const business = await getBusiness(businessId);
          if (business) {
            await updateBusiness(businessId, {
              plan: plan ?? business.plan,
              billingInterval: billingInterval ?? business.billingInterval,
              stripeCustomerId: customerId ?? business.stripeCustomerId,
              stripeSubscriptionId: subscriptionId ?? business.stripeSubscriptionId,
              subscriptionStatus: "active",
              status: business.isDeployed ? "live" : "active"
            });
          }
        }
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = getInvoiceFromEventObject(event.data.object);
        const subscriptionId = getSubscriptionIdFromInvoice(invoice);

        if (subscriptionId) {
          const business = await findBusinessByStripeSubscriptionId(subscriptionId);
          if (business) {
            await updateBusiness(business.id, {
              subscriptionStatus: "active",
              status: business.isDeployed ? "live" : "active"
            });
          }
        }
        break;
      }

      case "invoice.payment_failed":
      case "customer.subscription.deleted": {
        const object = getSubscriptionLikeFromEventObject(event.data.object);
        const subscriptionId = getSubscriptionIdFromEventObject(object);

        if (subscriptionId) {
          const business = await findBusinessByStripeSubscriptionId(subscriptionId);
          if (business) {
            await updateBusiness(business.id, {
              subscriptionStatus: event.type === "invoice.payment_failed" ? "past_due" : "canceled",
              status: "suspended",
              isDeployed: false
            });
          }
        }
        break;
      }

      default:
        break;
    }

    return json({ received: true });
  } catch (error) {
    return json(
      { error: error instanceof Error ? error.message : "Unable to process Stripe webhook." },
      { status: 400 }
    );
  }
}
