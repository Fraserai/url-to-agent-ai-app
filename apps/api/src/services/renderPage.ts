import type { FetchedPageArtifact, RenderSignals } from "@/apps/api/src/services/ingestionTypes";
import { ensureSafeTarget, normalizeUrl } from "@/apps/api/src/services/urlSafety";

const RENDER_TIMEOUT_MS = 20_000;

export async function renderPage(url: string): Promise<FetchedPageArtifact> {
  const normalized = normalizeUrl(url);
  await ensureSafeTarget(normalized.normalizedUrl);

  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({
    headless: true
  });

  try {
    const context = await browser.newContext({
      locale: "en-AU",
      viewport: {
        width: 1440,
        height: 960
      }
    });
    const page = await context.newPage();

    try {
      await page.goto(normalized.normalizedUrl, {
        waitUntil: "domcontentloaded",
        timeout: RENDER_TIMEOUT_MS
      });

      try {
        await page.waitForLoadState("networkidle", {
          timeout: 4_000
        });
      } catch {
        // Some pages never settle fully; the DOM is still usable.
      }

      const finalUrl = normalizeUrl(page.url() || normalized.normalizedUrl).normalizedUrl;
      await ensureSafeTarget(finalUrl);

      const html = await page.content();
      const renderSignals = await page.evaluate<RenderSignals>(() => {
        function sampleStyle(selector: string, property: "color" | "backgroundColor" | "fontFamily") {
          const element = document.querySelector(selector);
          if (!element) return "";
          return window.getComputedStyle(element)[property] || "";
        }

        function normalizeColor(value: string) {
          const trimmed = value.trim();
          if (!trimmed || trimmed === "rgba(0, 0, 0, 0)" || trimmed === "transparent") {
            return "";
          }
          return trimmed;
        }

        function normalizeFont(value: string) {
          return value
            .split(",")
            .map((part) => part.replace(/['"]/g, "").trim())
            .filter(Boolean)[0] ?? "";
        }

        const colors = [
          sampleStyle("body", "color"),
          sampleStyle("body", "backgroundColor"),
          sampleStyle("h1", "color"),
          sampleStyle("h2", "color"),
          sampleStyle("button", "backgroundColor"),
          sampleStyle("a", "color"),
          sampleStyle("nav", "backgroundColor"),
          sampleStyle("footer", "backgroundColor")
        ]
          .map(normalizeColor)
          .filter(Boolean);

        const fonts = [
          sampleStyle("body", "fontFamily"),
          sampleStyle("h1", "fontFamily"),
          sampleStyle("h2", "fontFamily"),
          sampleStyle("button", "fontFamily"),
          sampleStyle("nav", "fontFamily"),
          sampleStyle("footer", "fontFamily")
        ]
          .map(normalizeFont)
          .filter(Boolean);

        const imageUrls = Array.from(document.querySelectorAll("img"))
          .map((image) => image.getAttribute("src") || "")
          .filter(Boolean)
          .slice(0, 20);

        return {
          colors,
          fonts,
          imageUrls,
          styleNotes: [
            colors.length ? `Detected ${colors.length} prominent computed colors.` : "",
            fonts.length ? `Detected ${fonts.length} distinct font samples.` : ""
          ].filter(Boolean)
        };
      });

      return {
        url: normalized.normalizedUrl,
        finalUrl,
        statusCode: 200,
        fetchMode: "rendered",
        wasRendered: true,
        html,
        contentType: "text/html",
        fetchWarnings: [`Rendered fallback used for ${finalUrl}`],
        renderSignals
      };
    } finally {
      await page.close();
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

