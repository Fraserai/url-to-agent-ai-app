import fs from "node:fs";
import path from "node:path";

import Stripe from "stripe";

const projectRoot = process.cwd();
const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

if (!stripeSecretKey) {
  console.error("STRIPE_SECRET_KEY is required to create the Stripe catalog.");
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2025-08-27.basil"
});

const pricingCatalog = JSON.parse(
  fs.readFileSync(path.join(projectRoot, "data", "pricing-catalog.json"), "utf8")
);

const envLines = [];
const activeProducts = await stripe.products.list({
  active: true,
  limit: 100
});
const activePrices = await stripe.prices.list({
  active: true,
  limit: 100
});

function getLookupKey(planId, suffix) {
  return `agentdrop_${planId}_${suffix}`;
}

function getEnvKey(planId, suffix) {
  return `STRIPE_PRICE_${planId.toUpperCase()}_${suffix.toUpperCase()}`;
}

async function findOrCreateProduct(plan) {
  const existingProduct =
    activeProducts.data.find((product) => product.metadata.agentdropPlanId === plan.id) ||
    activeProducts.data.find((product) => product.name === `AgentDrop ${plan.name}`);

  if (existingProduct) {
    return existingProduct;
  }

  const createdProduct = await stripe.products.create({
    name: `AgentDrop ${plan.name}`,
    description: plan.tagline,
    metadata: {
      agentdropPlanId: plan.id
    }
  });

  activeProducts.data.push(createdProduct);
  return createdProduct;
}

function priceMatches(price, expected) {
  return (
    price.active &&
    price.unit_amount === expected.unitAmount &&
    (price.currency || "").toLowerCase() === expected.currency &&
    (price.recurring?.interval || null) === expected.interval &&
    price.product === expected.productId
  );
}

async function findOrCreatePrice(input) {
  const existingPrice = activePrices.data.find((price) => price.lookup_key === input.lookupKey);
  if (existingPrice && priceMatches(existingPrice, input)) {
    return existingPrice;
  }

  const createdPrice = await stripe.prices.create({
    product: input.productId,
    currency: input.currency,
    unit_amount: input.unitAmount,
    lookup_key: input.lookupKey,
    transfer_lookup_key: Boolean(existingPrice),
    recurring: input.interval
      ? {
          interval: input.interval
        }
      : undefined,
    nickname: input.nickname,
    metadata: input.metadata
  });

  activePrices.data.push(createdPrice);
  return createdPrice;
}

for (const plan of pricingCatalog) {
  const product = await findOrCreateProduct(plan);

  const recurringMonthlyPrice = await findOrCreatePrice({
    productId: product.id,
    currency: "aud",
    interval: "month",
    lookupKey: getLookupKey(plan.id, "monthly"),
    nickname: `${plan.name} monthly`,
    unitAmount: plan.monthly * 100,
    metadata: {
      agentdropPlanId: plan.id,
      agentdropPriceType: "monthly"
    }
  });

  const recurringAnnualPrice = await findOrCreatePrice({
    productId: product.id,
    currency: "aud",
    interval: "year",
    lookupKey: getLookupKey(plan.id, "annual"),
    nickname: `${plan.name} annual`,
    unitAmount: plan.annual * 100,
    metadata: {
      agentdropPlanId: plan.id,
      agentdropPriceType: "annual"
    }
  });

  const setupPrice = await findOrCreatePrice({
    productId: product.id,
    currency: "aud",
    interval: null,
    lookupKey: getLookupKey(plan.id, "setup"),
    nickname: `${plan.name} setup`,
    unitAmount: plan.setup * 100,
    metadata: {
      agentdropPlanId: plan.id,
      agentdropPriceType: "setup"
    }
  });

  envLines.push(`${getEnvKey(plan.id, "monthly")}=${recurringMonthlyPrice.id}`);
  envLines.push(`${getEnvKey(plan.id, "annual")}=${recurringAnnualPrice.id}`);
  envLines.push(`${getEnvKey(plan.id, "setup")}=${setupPrice.id}`);
}

console.log("Stripe catalog is ready. Add these env vars to Vercel or your production env:");
envLines.forEach((line) => console.log(line));
process.exit(0);
