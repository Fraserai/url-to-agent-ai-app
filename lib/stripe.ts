import Stripe from "stripe";

import { PLANS } from "@/lib/brand";
import type { BillingInterval, BusinessRecord, PlanId } from "@/lib/types";

let stripeClient: Stripe | null | undefined;

const STRIPE_PRICE_ENV_KEYS: Record<
  PlanId,
  {
    monthly: string;
    annual: string;
    setup: string;
  }
> = {
  starter: {
    monthly: "STRIPE_PRICE_STARTER_MONTHLY",
    annual: "STRIPE_PRICE_STARTER_ANNUAL",
    setup: "STRIPE_PRICE_STARTER_SETUP"
  },
  growth: {
    monthly: "STRIPE_PRICE_GROWTH_MONTHLY",
    annual: "STRIPE_PRICE_GROWTH_ANNUAL",
    setup: "STRIPE_PRICE_GROWTH_SETUP"
  },
  premium: {
    monthly: "STRIPE_PRICE_PREMIUM_MONTHLY",
    annual: "STRIPE_PRICE_PREMIUM_ANNUAL",
    setup: "STRIPE_PRICE_PREMIUM_SETUP"
  }
};

function getPlanPricing(planId: PlanId) {
  const plan = PLANS.find((item) => item.id === planId);
  if (!plan) {
    throw new Error(`Unknown plan: ${planId}`);
  }

  return plan;
}

function getConfiguredPriceId(planId: PlanId, key: "monthly" | "annual" | "setup") {
  return process.env[STRIPE_PRICE_ENV_KEYS[planId][key]] || null;
}

function buildRecurringLineItem(input: {
  planId: PlanId;
  billingInterval: BillingInterval;
  businessName: string;
  planName: string;
  unitAmount: number;
}) {
  const configuredPriceId = getConfiguredPriceId(
    input.planId,
    input.billingInterval === "annual" ? "annual" : "monthly"
  );

  if (configuredPriceId) {
    return {
      price: configuredPriceId,
      quantity: 1
    } satisfies Stripe.Checkout.SessionCreateParams.LineItem;
  }

  return {
    price_data: {
      currency: "aud",
      product_data: {
        name: `AgentDrop ${input.planName}`,
        description: `AgentDrop ${input.planName} plan for ${input.businessName}`
      },
      recurring: {
        interval: input.billingInterval === "annual" ? "year" : "month"
      },
      unit_amount: input.unitAmount
    },
    quantity: 1
  } satisfies Stripe.Checkout.SessionCreateParams.LineItem;
}

function buildSetupLineItem(input: {
  planId: PlanId;
  businessName: string;
  planName: string;
  unitAmount: number;
}) {
  const configuredPriceId = getConfiguredPriceId(input.planId, "setup");

  if (configuredPriceId) {
    return {
      price: configuredPriceId,
      quantity: 1
    } satisfies Stripe.Checkout.SessionCreateParams.LineItem;
  }

  return {
    price_data: {
      currency: "aud",
      product_data: {
        name: `${input.planName} setup fee`,
        description: `One-time AgentDrop setup for ${input.businessName}`
      },
      unit_amount: input.unitAmount
    },
    quantity: 1
  } satisfies Stripe.Checkout.SessionCreateParams.LineItem;
}

export function hasStripeConfig() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export function getStripeClient() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return null;
  }

  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: "2025-08-27.basil"
    });
  }

  return stripeClient;
}

export async function createCheckoutSession(input: {
  business: BusinessRecord;
  plan: PlanId;
  billingInterval: BillingInterval;
  origin: string;
  nextPath: string;
}) {
  const stripe = getStripeClient();
  if (!stripe) {
    throw new Error("Stripe is not configured.");
  }

  const plan = getPlanPricing(input.plan);
  const recurringUnitAmount =
    input.billingInterval === "annual" ? plan.annual * 100 : plan.monthly * 100;

  const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
    buildRecurringLineItem({
      planId: input.plan,
      billingInterval: input.billingInterval,
      businessName: input.business.businessName,
      planName: plan.name,
      unitAmount: recurringUnitAmount
    })
  ];

  if (input.billingInterval === "monthly") {
    lineItems.unshift(
      buildSetupLineItem({
        planId: input.plan,
        businessName: input.business.businessName,
        planName: plan.name,
        unitAmount: plan.setup * 100
      })
    );
  }

  return stripe.checkout.sessions.create({
    mode: "subscription",
    success_url: `${input.origin}${input.nextPath}?checkout=success`,
    cancel_url: `${input.origin}/pricing?businessId=${input.business.id}&next=${encodeURIComponent(
      input.nextPath
    )}`,
    customer_email: input.business.email ?? undefined,
    line_items: lineItems,
    metadata: {
      businessId: input.business.id,
      plan: input.plan,
      billingInterval: input.billingInterval
    },
    subscription_data: {
      metadata: {
        businessId: input.business.id,
        plan: input.plan,
        billingInterval: input.billingInterval
      }
    }
  });
}

export function constructStripeEvent(payload: string, signature: string) {
  const stripe = getStripeClient();
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    throw new Error("Stripe webhook verification is not configured.");
  }

  return stripe.webhooks.constructEvent(payload, signature, process.env.STRIPE_WEBHOOK_SECRET);
}
