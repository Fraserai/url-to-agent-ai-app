import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const productionMode = args.has("--production");
const checkDb = args.has("--check-db");

const REQUIRED_ENV_KEYS = [
  "NEXT_PUBLIC_APP_URL",
  "ANTHROPIC_API_KEY",
  "SUPABASE_URL",
  "SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
];

const STRIPE_PRICE_GROUPS = {
  starter: [
    "STRIPE_PRICE_STARTER_MONTHLY",
    "STRIPE_PRICE_STARTER_ANNUAL",
    "STRIPE_PRICE_STARTER_SETUP"
  ],
  growth: [
    "STRIPE_PRICE_GROWTH_MONTHLY",
    "STRIPE_PRICE_GROWTH_ANNUAL",
    "STRIPE_PRICE_GROWTH_SETUP"
  ],
  premium: [
    "STRIPE_PRICE_PREMIUM_MONTHLY",
    "STRIPE_PRICE_PREMIUM_ANNUAL",
    "STRIPE_PRICE_PREMIUM_SETUP"
  ]
};

const errors = [];
const warnings = [];

function isSet(name) {
  return Boolean(process.env[name] && process.env[name].trim());
}

function getUrlHost(value) {
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

function printSection(title, lines) {
  console.log(`\n${title}`);
  lines.forEach((line) => console.log(line));
}

for (const key of REQUIRED_ENV_KEYS) {
  if (!isSet(key)) {
    errors.push(`Missing required env: ${key}`);
  }
}

if (productionMode && isSet("NEXT_PUBLIC_APP_URL")) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl.startsWith("https://")) {
    errors.push("NEXT_PUBLIC_APP_URL must use https in production.");
  }
  if (appUrl.includes("localhost") || appUrl.includes("127.0.0.1")) {
    errors.push("NEXT_PUBLIC_APP_URL cannot point to localhost in production.");
  }
}

if (isSet("SUPABASE_URL") && isSet("NEXT_PUBLIC_SUPABASE_URL")) {
  if (getUrlHost(process.env.SUPABASE_URL) !== getUrlHost(process.env.NEXT_PUBLIC_SUPABASE_URL)) {
    errors.push("SUPABASE_URL and NEXT_PUBLIC_SUPABASE_URL must point to the same Supabase project.");
  }
}

for (const [planId, keys] of Object.entries(STRIPE_PRICE_GROUPS)) {
  const configuredCount = keys.filter((key) => isSet(key)).length;
  if (configuredCount > 0 && configuredCount < keys.length) {
    warnings.push(
      `Stripe price IDs for ${planId} are partially configured. Set all of ${keys.join(", ")} or leave them all blank.`
    );
  }
}

if (checkDb) {
  if (isSet("SUPABASE_URL") && isSet("SUPABASE_SERVICE_ROLE_KEY")) {
    try {
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: {
          persistSession: false
        }
      });

      const tableNames = ["businesses", "conversations"];

      for (const tableName of tableNames) {
        const { error } = await supabase.from(tableName).select("id", {
          count: "exact",
          head: true
        });

        if (error) {
          errors.push(`Supabase table check failed for ${tableName}: ${error.message}`);
        }
      }
    } catch (error) {
      errors.push(
        `Supabase connectivity check failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  } else {
    warnings.push("Skipped Supabase schema check because Supabase env vars are not fully configured.");
  }
}

printSection("AgentDrop Production Preflight", [
  `Mode: ${productionMode ? "production" : "basic"}`,
  `Database check: ${checkDb ? "enabled" : "disabled"}`
]);

printSection(
  "Environment",
  REQUIRED_ENV_KEYS.map((key) => `${isSet(key) ? "[ok]" : "[missing]"} ${key}`)
);

if (warnings.length) {
  printSection(
    "Warnings",
    warnings.map((warning) => `[warn] ${warning}`)
  );
}

if (errors.length) {
  printSection(
    "Errors",
    errors.map((error) => `[error] ${error}`)
  );
  process.exit(1);
} else {
  printSection("Result", ["[ok] Preflight passed."]);
  process.exit(0);
}
