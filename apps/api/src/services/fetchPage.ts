import type { FetchedPageArtifact } from "@/apps/api/src/services/ingestionTypes";
import { ensureSafeTarget, normalizeUrl } from "@/apps/api/src/services/urlSafety";

const USER_AGENT =
  "AgentdropBot/0.1 (+https://agentdrop.local) Mozilla/5.0 (compatible; AgentdropIngestion/0.1)";
const DEFAULT_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 5;

type RequestResult = {
  finalUrl: string;
  statusCode: number;
  contentType: string;
  html: string;
  warnings: string[];
};

function isRedirect(status: number) {
  return [301, 302, 303, 307, 308].includes(status);
}

function isHtmlContent(contentType: string) {
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

async function fetchWithRedirects(url: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<RequestResult> {
  let currentUrl = normalizeUrl(url).normalizedUrl;
  const warnings: string[] = [];

  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    await ensureSafeTarget(currentUrl);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(currentUrl, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "accept": "text/html,application/xhtml+xml,text/plain;q=0.9,*/*;q=0.5",
          "accept-language": "en-AU,en;q=0.9,en-US;q=0.8",
          "cache-control": "no-cache",
          pragma: "no-cache",
          "user-agent": USER_AGENT
        }
      });

      if (isRedirect(response.status)) {
        const location = response.headers.get("location");
        if (!location) {
          throw new Error("Redirect response was missing a Location header");
        }

        const nextUrl = new URL(location, currentUrl).toString();
        warnings.push(`Redirected from ${currentUrl} to ${nextUrl}`);
        currentUrl = normalizeUrl(nextUrl).normalizedUrl;
        continue;
      }

      const contentType = response.headers.get("content-type") ?? "";

      if (!response.ok) {
        throw new Error(`Website request failed with ${response.status}`);
      }

      const html = await response.text();

      return {
        finalUrl: currentUrl,
        statusCode: response.status,
        contentType,
        html,
        warnings
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error("Too many redirects");
}

export async function fetchPage(url: string): Promise<FetchedPageArtifact> {
  const result = await fetchWithRedirects(url);

  if (!isHtmlContent(result.contentType)) {
    throw new Error("The target did not return HTML content");
  }

  return {
    url,
    finalUrl: result.finalUrl,
    statusCode: result.statusCode,
    fetchMode: "static",
    wasRendered: false,
    html: result.html,
    contentType: result.contentType,
    fetchWarnings: result.warnings
  };
}

export function needsRender(input: {
  html: string;
  visibleText: string;
  statusCode: number;
}) {
  if (input.statusCode >= 400) {
    return false;
  }

  const lowerHtml = input.html.toLowerCase();

  return (
    input.visibleText.trim().length < 700 ||
    /id=["'](?:root|app|__next)["']/.test(lowerHtml) ||
    lowerHtml.includes("__next_data__") ||
    lowerHtml.includes("webpack") ||
    lowerHtml.includes("hydration") ||
    lowerHtml.includes("window.__") ||
    lowerHtml.includes("data-reactroot")
  );
}

