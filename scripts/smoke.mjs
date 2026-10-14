import fs from "node:fs";
import path from "node:path";

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith("--")) continue;

    const key = arg.slice(2);
    const next = argv[index + 1];

    if (!next || next.startsWith("--")) {
      options[key] = true;
      continue;
    }

    options[key] = next;
    index += 1;
  }

  return options;
}

function createCookieJar() {
  return new Map();
}

function setCookiesFromResponse(response, jar) {
  const setCookies =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : response.headers.get("set-cookie")
        ? [response.headers.get("set-cookie")]
        : [];

  for (const cookieLine of setCookies) {
    if (!cookieLine) continue;
    const firstPart = cookieLine.split(";")[0];
    const separatorIndex = firstPart.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = firstPart.slice(0, separatorIndex);
    const value = firstPart.slice(separatorIndex + 1);
    jar.set(name, value);
  }
}

function buildCookieHeader(jar) {
  return Array.from(jar.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

async function request(baseUrl, pathname, input = {}) {
  const headers = {};

  if (input.json !== undefined) {
    headers["content-type"] = "application/json";
  }

  if (input.jar && input.jar.size) {
    headers.cookie = buildCookieHeader(input.jar);
  }

  const response = await fetch(`${baseUrl}${pathname}`, {
    method: input.method || "GET",
    headers,
    body: input.json !== undefined ? JSON.stringify(input.json) : undefined,
    redirect: "manual"
  });

  if (input.jar) {
    setCookiesFromResponse(response, input.jar);
  }

  const text = await response.text();
  let body = text;

  try {
    body = JSON.parse(text);
  } catch {
    // Keep plain-text and HTML responses as-is.
  }

  return {
    status: response.status,
    location: response.headers.get("location"),
    contentType: response.headers.get("content-type"),
    body
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readLocalDatabase() {
  const dbPath = path.join(process.cwd(), ".data", "agentdrop.json");
  return JSON.parse(fs.readFileSync(dbPath, "utf8"));
}

async function runPublicSmoke(baseUrl, options) {
  const results = [];

  const home = await request(baseUrl, "/");
  assert(home.status === 200, `Expected / to return 200, got ${home.status}`);
  results.push({ step: "home", status: home.status });

  const pricing = await request(baseUrl, "/pricing");
  assert(pricing.status === 200, `Expected /pricing to return 200, got ${pricing.status}`);
  results.push({ step: "pricing", status: pricing.status });

  const dashboard = await request(baseUrl, "/dashboard");
  assert([307, 308].includes(dashboard.status), `Expected /dashboard redirect, got ${dashboard.status}`);
  results.push({ step: "dashboard-anon", status: dashboard.status, location: dashboard.location });

  if (options["scan-url"]) {
    const scan = await request(baseUrl, "/api/scan", {
      method: "POST",
      json: {
        url: options["scan-url"]
      }
    });

    assert(scan.status === 200, `Expected /api/scan 200, got ${scan.status}`);
    assert(scan.body?.business?.id, "Expected /api/scan to return business.id");
    results.push({
      step: "scan",
      status: scan.status,
      businessId: scan.body.business.id
    });
  }

  if (options["chat-business-id"]) {
    const chat = await request(baseUrl, "/api/chat", {
      method: "POST",
      json: {
        businessId: options["chat-business-id"],
        visitorId: `smoke-${Date.now()}`,
        messages: [
          {
            role: "user",
            content: "Hello from the AgentDrop smoke test.",
            timestamp: new Date().toISOString()
          }
        ]
      }
    });

    assert(chat.status === 200, `Expected /api/chat 200, got ${chat.status}`);
    assert(typeof chat.body?.reply === "string", "Expected /api/chat to return a reply");
    results.push({ step: "chat", status: chat.status });
  }

  if (options["widget-business-id"]) {
    const widget = await request(baseUrl, `/api/widget/${options["widget-business-id"]}`);
    assert(widget.status === 200, `Expected widget endpoint 200, got ${widget.status}`);
    assert(
      (widget.contentType || "").includes("application/javascript"),
      `Expected widget JavaScript content-type, got ${widget.contentType}`
    );
    results.push({ step: "widget", status: widget.status });
  }

  return results;
}

async function runLocalFallbackSmoke(baseUrl, options) {
  const results = [];
  const jar = createCookieJar();
  const loginEmail = options.email || "owner@example.com";

  const home = await request(baseUrl, "/");
  assert(home.status === 200, `Expected / to return 200, got ${home.status}`);
  results.push({ step: "home", status: home.status });

  const pricing = await request(baseUrl, "/pricing");
  assert(pricing.status === 200, `Expected /pricing to return 200, got ${pricing.status}`);
  results.push({ step: "pricing", status: pricing.status });

  const dashboardAnon = await request(baseUrl, "/dashboard");
  assert([307, 308].includes(dashboardAnon.status), `Expected /dashboard redirect, got ${dashboardAnon.status}`);
  results.push({ step: "dashboard-anon", status: dashboardAnon.status, location: dashboardAnon.location });

  const scan = await request(baseUrl, "/api/scan", {
    method: "POST",
    jar,
    json: {
      url: options["scan-url"] || "https://example.com"
    }
  });

  assert(scan.status === 200, `Expected /api/scan 200, got ${scan.status}`);
  assert(scan.body?.business?.id, "Expected /api/scan to return business.id");

  const businessId = scan.body.business.id;
  const draftCookieName = `agentdrop_draft_${businessId}`;
  assert(jar.has(draftCookieName), `Expected draft cookie ${draftCookieName}`);
  results.push({ step: "scan", status: scan.status, businessId });

  const agentPage = await request(baseUrl, `/agent/${businessId}`, { jar });
  assert(agentPage.status === 200, `Expected draft agent page 200, got ${agentPage.status}`);

  const chatPage = await request(baseUrl, `/agent/${businessId}/chat`, { jar });
  assert(chatPage.status === 200, `Expected draft chat page 200, got ${chatPage.status}`);
  results.push({ step: "draft-pages", agentStatus: agentPage.status, chatStatus: chatPage.status });

  const saveBlocked = await request(baseUrl, `/api/business/${businessId}`, {
    method: "PUT",
    jar,
    json: {
      businessName: "Example Company",
      industry: "Business",
      services: ["Support"],
      serviceArea: "Australia",
      phone: null,
      email: null,
      hours: null,
      description: "Updated in smoke test",
      keyInfo: "Fast support",
      accentColor: "#1a6b4a"
    }
  });

  assert(saveBlocked.status === 401, `Expected anonymous save 401, got ${saveBlocked.status}`);
  results.push({ step: "anonymous-save-blocked", status: saveBlocked.status });

  const login = await request(baseUrl, "/api/auth/magic-link", {
    method: "POST",
    jar,
    json: {
      email: loginEmail,
      next: `/agent/${businessId}/deploy`,
      draftId: businessId
    }
  });

  assert(login.status === 200, `Expected /api/auth/magic-link 200, got ${login.status}`);
  assert(jar.has("agentdrop_local_user"), "Expected local auth cookie after fallback login");
  results.push({ step: "magic-link-claim", status: login.status, redirectTo: login.body?.redirectTo });

  const dashboardAuthed = await request(baseUrl, "/dashboard", { jar });
  assert(dashboardAuthed.status === 200, `Expected authed dashboard 200, got ${dashboardAuthed.status}`);
  results.push({ step: "dashboard-authed", status: dashboardAuthed.status });

  const deployBlocked = await request(baseUrl, "/api/deploy", {
    method: "POST",
    jar,
    json: {
      businessId,
      platform: "shopify"
    }
  });

  assert(deployBlocked.status === 402, `Expected deploy before checkout 402, got ${deployBlocked.status}`);
  results.push({ step: "deploy-blocked-before-checkout", status: deployBlocked.status });

  const checkout = await request(baseUrl, "/api/checkout", {
    method: "POST",
    jar,
    json: {
      businessId,
      plan: "growth",
      billingInterval: "monthly",
      next: `/agent/${businessId}/deploy`
    }
  });

  assert(checkout.status === 200, `Expected /api/checkout 200, got ${checkout.status}`);
  results.push({ step: "checkout", status: checkout.status, checkoutUrl: checkout.body?.checkoutUrl });

  const deploy = await request(baseUrl, "/api/deploy", {
    method: "POST",
    jar,
    json: {
      businessId,
      platform: "shopify"
    }
  });

  assert(deploy.status === 200, `Expected deploy 200, got ${deploy.status}`);
  results.push({ step: "deploy", status: deploy.status, widgetUrl: deploy.body?.widgetUrl });

  const chatOne = await request(baseUrl, "/api/chat", {
    method: "POST",
    json: {
      businessId,
      visitorId: "smoke-visitor-1",
      messages: [
        {
          role: "user",
          content:
            "My name is Jane Doe and my email is jane@example.com and my phone is 0412 345 678. I need a quote.",
          timestamp: new Date().toISOString()
        }
      ]
    }
  });

  assert(chatOne.status === 200, `Expected first /api/chat 200, got ${chatOne.status}`);

  const chatTwo = await request(baseUrl, "/api/chat", {
    method: "POST",
    json: {
      businessId,
      visitorId: "smoke-visitor-1",
      messages: [
        {
          role: "user",
          content:
            "My name is Jane Doe and my email is jane@example.com and my phone is 0412 345 678. Just following up.",
          timestamp: new Date().toISOString()
        }
      ]
    }
  });

  assert(chatTwo.status === 200, `Expected second /api/chat 200, got ${chatTwo.status}`);

  const database = readLocalDatabase();
  const notificationCount = database.notifications.filter(
    (notification) => notification.businessId === businessId
  ).length;
  assert(notificationCount === 1, `Expected one lead notification, got ${notificationCount}`);
  results.push({ step: "lead-idempotency", notifications: notificationCount });

  const widget = await request(baseUrl, `/api/widget/${businessId}`);
  assert(widget.status === 200, `Expected widget endpoint 200, got ${widget.status}`);
  assert(
    (widget.contentType || "").includes("application/javascript"),
    `Expected widget JavaScript content-type, got ${widget.contentType}`
  );
  results.push({ step: "widget", status: widget.status });

  return results;
}

const options = parseArgs(process.argv.slice(2));
const baseUrl = (options["base-url"] || process.env.NEXT_PUBLIC_APP_URL || "http://127.0.0.1:3000").replace(
  /\/$/,
  ""
);
const mode = options.mode || "public";

try {
  const results =
    mode === "local-fallback"
      ? await runLocalFallbackSmoke(baseUrl, options)
      : await runPublicSmoke(baseUrl, options);

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode,
        baseUrl,
        results
      },
      null,
      2
    )
  );
  process.exit(0);
} catch (error) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        mode,
        baseUrl,
        error: error instanceof Error ? error.message : "Unknown smoke test error"
      },
      null,
      2
    )
  );
  process.exit(1);
}
