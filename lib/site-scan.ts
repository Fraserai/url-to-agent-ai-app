import { AU_PHONE_REGEX, EMAIL_REGEX } from "@/lib/lead-detection";
import { domainToBusinessName, getDomain, normalizeUrl } from "@/lib/url";

const REQUEST_TIMEOUT_MS = 12000;
const MAX_PAGES = 7;
const MAX_PAGE_TEXT_CHARS = 3200;
const MAX_KNOWLEDGE_CHARS = 14000;
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

const PRIORITY_PATH_PATTERNS = [
  /^\/(?:[a-z]{2}(?:-[a-z]{2})?)?$/,
  /service|what-we-do|offer|solution|treatment|menu|product|shop|pricing|package|trainer|training/,
  /contact|location|locations|store|stores|find-us|faq|booking|appointment|inspection|gym|gyms|club|clubs/,
  /about|story|company/
];

const SKIP_PATH_PATTERNS = [
  /blog|news|article|career|job|privacy|terms|policy|cookie|legal|login|account|checkout|cart|franchise/
];

const COMMON_PATHS = [
  "/",
  "/about",
  "/about-us",
  "/services",
  "/service",
  "/contact",
  "/contact-us",
  "/faq",
  "/faqs",
  "/pricing",
  "/menu",
  "/gyms",
  "/join",
  "/personal-trainers",
  "/member-faqs",
  "/pages/menu",
  "/products",
  "/pages/stores",
  "/locations",
  "/find-a-store",
  "/stores",
  "/pages/about-us",
  "/booking",
  "/book-now",
  "/collections/all-day-menu",
  "/collections/evening-menu",
  "/collections/drinks"
];

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\""
};

const GENERIC_SERVICE_PHRASES = new Set([
  "about",
  "about us",
  "contact",
  "contact us",
  "home",
  "learn more",
  "read more",
  "book now",
  "get in touch",
  "our story",
  "welcome",
  "view more",
  "click here",
  "all services",
  "enquire now",
  "call now",
  "menu",
  "service",
  "services",
  "pricing",
  "products",
  "special offer",
  "special offers",
  "join now",
  "find a gym",
  "find a store",
  "find your local gym",
  "find your store",
  "member faqs",
  "member faq",
  "own a gym",
  "careers",
  "franchising",
  "dessert inspired"
]);

type StructuredHints = {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  hours?: string | null;
  description?: string | null;
  serviceArea?: string | null;
};

type CrawledPage = {
  url: string;
  title: string;
  description: string;
  headings: string[];
  links: string[];
  listItems: string[];
  paragraphs: string[];
  text: string;
  hints: StructuredHints;
};

type FetchedPage = {
  html: string;
  finalUrl: string;
};

type PageFetcher = (url: string) => Promise<FetchedPage>;

export type WebsiteScanResult = {
  finalUrl: string;
  domain: string;
  sourceUrls: string[];
  knowledgeText: string;
  scanMethod: "browser" | "html";
  scanWarnings: string[];
  combinedText: string;
  businessName: string;
  services: string[];
  serviceArea: string;
  phone: string | null;
  email: string | null;
  hours: string | null;
  description: string;
  keyInfo: string;
};

function decodeHtmlEntities(text: string) {
  return text.replace(/&(#x?[0-9a-f]+|\w+);/gi, (_, entity: string) => {
    if (entity.startsWith("#x")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }

    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    }

    return HTML_ENTITY_MAP[entity.toLowerCase()] ?? "";
  });
}

function cleanInlineText(text: string) {
  return decodeHtmlEntities(
    text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|section|article|h1|h2|h3|h4|h5|h6)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

function firstNonEmpty(...values: Array<string | null | undefined>) {
  return values.find((value) => value && value.trim())?.trim() ?? "";
}

function truncate(text: string, limit: number) {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit - 1).trim()}…`;
}

function normalizeSentenceText(text: string) {
  return cleanInlineText(text).replace(/\s+/g, " ").trim();
}

function toTitleCase(text: string) {
  return text
    .split(/\s+/)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

function normalizeCountryLabel(value: string) {
  const lower = value.trim().toLowerCase();

  if (lower === "au" || lower === "australia" || lower === "australian") {
    return "Australia";
  }

  if (lower === "nz" || lower === "new zealand") {
    return "New Zealand";
  }

  if (lower === "uk" || lower === "united kingdom") {
    return "United Kingdom";
  }

  if (lower === "us" || lower === "usa" || lower === "united states") {
    return "United States";
  }

  if (lower === "ca" || lower === "canada") {
    return "Canada";
  }

  if (lower === "sg" || lower === "singapore") {
    return "Singapore";
  }

  if (lower === "ie" || lower === "ireland") {
    return "Ireland";
  }

  if (lower === "ae" || lower === "united arab emirates") {
    return "United Arab Emirates";
  }

  return value.trim();
}

function inferRegionalDefault(url: string, text: string) {
  const lowerText = text.toLowerCase();

  const regionMatch = lowerText.match(
    /\b(australia|australian|new zealand|united states|usa|united kingdom|uk|canada|singapore|ireland)\b/i
  )?.[1];
  if (regionMatch) {
    return normalizeCountryLabel(regionMatch);
  }

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    const pathname = parsed.pathname.toLowerCase();

    if (hostname.endsWith(".com.au") || hostname.endsWith(".au") || pathname === "/au" || pathname.startsWith("/au/")) {
      return "Australia";
    }

    if (pathname === "/nz" || pathname.startsWith("/nz/")) {
      return "New Zealand";
    }

    if (pathname === "/uk" || pathname.startsWith("/uk/")) {
      return "United Kingdom";
    }

    if (pathname === "/us" || pathname.startsWith("/us/")) {
      return "United States";
    }

    if (pathname === "/ca" || pathname.startsWith("/ca/")) {
      return "Canada";
    }

    if (pathname === "/sg" || pathname.startsWith("/sg/")) {
      return "Singapore";
    }
  } catch {
    // Ignore malformed URLs and fall through to an empty default.
  }

  return "";
}

function getLocalePrefixPath(homepageUrl: string) {
  try {
    const pathname = new URL(homepageUrl).pathname.replace(/\/+$/, "") || "/";
    const segments = pathname.split("/").filter(Boolean);
    const firstSegment = segments[0]?.toLowerCase();

    if (!firstSegment) {
      return "";
    }

    if (/^(au|nz|uk|us|ca|ie|sg|ae|eu|[a-z]{2}-[a-z]{2}|en-[a-z]{2})$/.test(firstSegment)) {
      return `/${segments[0]}`;
    }
  } catch {
    // Ignore malformed URLs and fall back to root-level paths.
  }

  return "";
}

function scoreBusinessNameCandidate(name: string, domain: string) {
  const cleaned = cleanInlineText(name);
  if (!cleaned) return Number.NEGATIVE_INFINITY;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const lower = cleaned.toLowerCase();
  const domainRoot = domain.split(".")[0]?.replace(/[^a-z0-9]+/gi, "") ?? "";
  const candidateAlpha = cleaned.toLowerCase().replace(/[^a-z0-9]+/g, "");
  let score = 0;

  score += Math.min(words.length, 5) * 4;
  score += Math.min(cleaned.length, 40) / 4;

  if (domainRoot && candidateAlpha.includes(domainRoot)) {
    score += 10;
  }

  if (/home|contact|about|services|locations|faq/i.test(cleaned)) {
    score -= 6;
  }

  if (/number 1|your local expert|call\b|book now|learn more/i.test(cleaned)) {
    score -= 8;
  }

  if (words.length === 1 && cleaned.length <= 6) {
    score -= 10;
  }

  return score;
}

function pickBusinessName(candidates: Array<string | null | undefined>, domain: string) {
  const options = unique(candidates.map((candidate) => cleanInlineText(candidate ?? "")).filter(Boolean));

  return (
    options.sort(
      (left, right) => scoreBusinessNameCandidate(right, domain) - scoreBusinessNameCandidate(left, domain)
    )[0] ?? domainToBusinessName(domain)
  );
}

function scoreDescriptionCandidate(candidate: string, fallbackBusinessName: string) {
  const cleaned = normalizeSentenceText(candidate);
  if (!cleaned) return Number.NEGATIVE_INFINITY;

  const words = cleaned.split(/\s+/).filter(Boolean);
  const lower = cleaned.toLowerCase();
  let score = cleaned.length;

  if (cleaned.length < 35) return Number.NEGATIVE_INFINITY;
  if (words.length < 6) return Number.NEGATIVE_INFINITY;

  if (cleaned.toUpperCase() === cleaned && /[A-Z]/.test(cleaned)) {
    score -= 30;
  }

  if (/^whoops\b|404|not found/i.test(cleaned)) {
    return Number.NEGATIVE_INFINITY;
  }

  if (/^(enquire|book now|order now|learn more|read more|click here)\b/i.test(lower)) {
    score -= 25;
  }

  if (/franchise|franchisee/.test(lower) && !/franchise/i.test(fallbackBusinessName)) {
    score -= 12;
  }

  if (/[.!?]/.test(cleaned)) {
    score += 15;
  }

  if (/\b(service|services|menu|products|appointments|book|contact|hours|customers|business|team)\b/i.test(cleaned)) {
    score += 10;
  }

  if (/\bwe\b|\bour\b|\byou\b/i.test(lower)) {
    score += 6;
  }

  if (words.length > 28) {
    score -= 10;
  }

  return score;
}

function canonicalizeUrl(input: string, base?: string) {
  const url = new URL(input, base);
  url.hash = "";
  url.search = "";
  if (url.pathname !== "/" && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }
  return url.toString();
}

function isSameDomain(url: string, domain: string) {
  try {
    return getDomain(url) === domain;
  } catch {
    return false;
  }
}

function looksLikeHtml(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  return /text\/html|application\/xhtml\+xml/i.test(contentType);
}

async function fetchHtmlPage(url: string): Promise<FetchedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: {
        "accept":
          "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8,*/*;q=0.7",
        "accept-language": "en-AU,en;q=0.9,en-US;q=0.8",
        "cache-control": "no-cache",
        pragma: "no-cache",
        "user-agent": USER_AGENT
      },
      redirect: "follow",
      cache: "no-store",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`Website request failed with ${response.status}`);
    }

    if (!looksLikeHtml(response)) {
      throw new Error("The website did not return HTML content.");
    }

    return {
      html: await response.text(),
      finalUrl: canonicalizeUrl(response.url || url)
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function createBrowserPageFetcher() {
  const playwright = await import("playwright");
  const browser = await playwright.chromium.launch({
    headless: true
  });
  const context = await browser.newContext({
    locale: "en-AU",
    userAgent: USER_AGENT,
    viewport: {
      width: 1440,
      height: 960
    }
  });

  const fetchPage: PageFetcher = async (url) => {
    const page = await context.newPage();

    try {
      await page.goto(url, {
        waitUntil: "domcontentloaded",
        timeout: REQUEST_TIMEOUT_MS
      });

      try {
        await page.waitForLoadState("networkidle", {
          timeout: 3000
        });
      } catch {
        // Some sites never settle cleanly; the rendered DOM is still useful.
      }

      const finalUrl = canonicalizeUrl(page.url() || url);
      const html = await page.content();

      if (!html.trim()) {
        throw new Error("Rendered page was empty.");
      }

      return {
        html,
        finalUrl
      };
    } finally {
      await page.close();
    }
  };

  return {
    fetchPage,
    close: async () => {
      await context.close();
      await browser.close();
    }
  };
}

function extractMetaContent(html: string, type: "name" | "property", key: string) {
  const pattern = new RegExp(
    `<meta[^>]+${type}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );
  return cleanInlineText(html.match(pattern)?.[1] ?? "");
}

function extractTagContents(html: string, tag: string) {
  return Array.from(html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")))
    .map((match) => cleanInlineText(match[1] ?? ""))
    .filter(Boolean);
}

function extractLinks(html: string, baseUrl: string, domain: string) {
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi))
    .map((match) => match[1] ?? "")
    .filter((href) => href && !/^(mailto:|tel:|javascript:)/i.test(href))
    .filter((href) => !/\.(pdf|jpg|jpeg|png|gif|svg|webp|avif|mp4|mov|zip|ics|xml)(\?|$)/i.test(href))
    .map((href) => {
      try {
        return canonicalizeUrl(href, baseUrl);
      } catch {
        return null;
      }
    })
    .filter((href): href is string => Boolean(href))
    .filter((href) => isSameDomain(href, domain));

  return unique(links);
}

function extractLinkedContact(html: string) {
  function formatPhoneValue(value: string) {
    const digits = value.replace(/\D+/g, "");

    if (/^13\d{4}$/.test(digits)) {
      return `${digits.slice(0, 3)} ${digits.slice(3)}`;
    }

    if (/^1300\d{6}$/.test(digits)) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
    }

    return value.trim();
  }

  const email = Array.from(html.matchAll(/href=["']mailto:([^"'?#]+)[^"']*["']/gi))
    .map((match) => cleanInlineText(match[1] ?? ""))
    .find(Boolean);
  const phone = Array.from(html.matchAll(/href=["']tel:([^"'?#]+)[^"']*["']/gi))
    .map((match) => formatPhoneValue(cleanInlineText(match[1] ?? "").replace(/[^\d+\s-]/g, "")))
    .find(Boolean);

  return {
    email: email || null,
    phone: phone || null
  };
}

function collectStructuredBusinessObjects(value: unknown, objects: Record<string, unknown>[]) {
  if (!value) return;

  if (Array.isArray(value)) {
    value.forEach((item) => collectStructuredBusinessObjects(item, objects));
    return;
  }

  if (typeof value !== "object") {
    return;
  }

  const record = value as Record<string, unknown>;
  const rawType = record["@type"];
  const typeValues = Array.isArray(rawType) ? rawType : [rawType];
  const typeText = typeValues.filter(Boolean).join(" ").toLowerCase();

  if (/(localbusiness|organization|store|restaurant|cafe|bar|dentist|medical|clinic|service|agency|venue|hotel|salon|spa|school)/.test(typeText)) {
    objects.push(record);
  }

  Object.values(record).forEach((child) => collectStructuredBusinessObjects(child, objects));
}

function extractStructuredHints(html: string): StructuredHints {
  const scripts = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  )
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];

  const hints: StructuredHints = {};

  for (const raw of scripts) {
    try {
      const parsed = JSON.parse(raw);
      const objects: Record<string, unknown>[] = [];
      collectStructuredBusinessObjects(parsed, objects);

      for (const object of objects) {
        if (!hints.name && typeof object.name === "string") {
          hints.name = cleanInlineText(object.name);
        }

        if (!hints.phone && typeof object.telephone === "string") {
          hints.phone = cleanInlineText(object.telephone);
        }

        if (!hints.email && typeof object.email === "string") {
          hints.email = cleanInlineText(object.email);
        }

        if (!hints.description && typeof object.description === "string") {
          hints.description = cleanInlineText(object.description);
        }

        if (!hints.serviceArea) {
          const area = object.areaServed;
          if (typeof area === "string") {
            hints.serviceArea = cleanInlineText(area);
          } else if (area && typeof area === "object") {
            const areaRecord = area as Record<string, unknown>;
            hints.serviceArea = firstNonEmpty(
              typeof areaRecord.name === "string" ? areaRecord.name : null,
              typeof areaRecord.addressLocality === "string" ? areaRecord.addressLocality : null,
              typeof areaRecord.addressRegion === "string" ? areaRecord.addressRegion : null
            );
          }
        }

        if (!hints.hours) {
          if (typeof object.openingHours === "string") {
            hints.hours = cleanInlineText(object.openingHours);
          } else if (Array.isArray(object.openingHoursSpecification)) {
            const chunks = object.openingHoursSpecification
              .map((item) => {
                if (!item || typeof item !== "object") return "";
                const record = item as Record<string, unknown>;
                const day = Array.isArray(record.dayOfWeek)
                  ? record.dayOfWeek
                      .map((entry) => String(entry).split("/").pop() ?? String(entry))
                      .join(", ")
                  : typeof record.dayOfWeek === "string"
                    ? String(record.dayOfWeek).split("/").pop()
                    : "";
                const opens = typeof record.opens === "string" ? record.opens : "";
                const closes = typeof record.closes === "string" ? record.closes : "";
                return [day, opens && closes ? `${opens}-${closes}` : ""].filter(Boolean).join(" ");
              })
              .filter(Boolean);

            if (chunks.length) {
              hints.hours = chunks.join("; ");
            }
          }
        }
      }
    } catch {
      // Ignore invalid JSON-LD blocks.
    }
  }

  return hints;
}

function detectBlockedPage(html: string, text: string) {
  const lower = `${html}\n${text}`.toLowerCase();
  return (
    lower.includes("enable javascript and cookies to continue") ||
    lower.includes("just a moment") ||
    lower.includes("cf-challenge") ||
    lower.includes("attention required")
  );
}

function extractPageText(html: string) {
  const region =
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    html.match(/<article[\s\S]*?<\/article>/i)?.[0] ??
    html.match(/<body[\s\S]*?<\/body>/i)?.[0] ??
    html;

  const headings = unique(extractTagContents(region, "h1").concat(extractTagContents(region, "h2")).concat(extractTagContents(region, "h3"))).slice(0, 12);
  const links = unique(extractTagContents(region, "a"))
    .filter((link) => {
      const wordCount = link.split(/\s+/).filter(Boolean).length;
      return wordCount >= 1 && wordCount <= 8 && link.length <= 80;
    })
    .slice(0, 40);
  const listItems = unique(extractTagContents(region, "li")).slice(0, 30);
  const paragraphs = unique(extractTagContents(region, "p"))
    .filter((paragraph) => paragraph.split(" ").length >= 5)
    .slice(0, 20);
  const fallbackLines = unique(
    cleanInlineText(region)
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => {
        const wordCount = line.split(/\s+/).filter(Boolean).length;
        return wordCount >= 2 && wordCount <= 24 && line.length <= 180;
      })
  ).slice(0, 40);
  const combinedBlocks = unique([...headings, ...paragraphs, ...listItems, ...links, ...fallbackLines])
    .filter((block) => block.length >= 3 && block.length <= 280)
    .slice(0, 45);

  return {
    headings,
    links,
    listItems,
    paragraphs,
    text: truncate(combinedBlocks.join("\n"), MAX_PAGE_TEXT_CHARS)
  };
}

function scorePath(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();
    if (SKIP_PATH_PATTERNS.some((pattern) => pattern.test(pathname))) return -10;

    for (let index = 0; index < PRIORITY_PATH_PATTERNS.length; index += 1) {
      if (PRIORITY_PATH_PATTERNS[index].test(pathname)) {
        return 10 - index;
      }
    }
  } catch {
    return 0;
  }

  return 1;
}

function classifyCandidatePath(url: string) {
  try {
    const pathname = new URL(url).pathname.toLowerCase();

    if (/contact|location|locations|store|stores|find-us|faq|booking|appointment|inspection|gym|gyms|club|clubs/.test(pathname)) {
      return "contact";
    }

    if (/about|story|company/.test(pathname)) {
      return "about";
    }

    if (/service|what-we-do|offer|solution|treatment|menu|product|shop|pricing|package|trainer|training/.test(pathname)) {
      return "service";
    }
  } catch {
    // Ignore malformed URLs and fall back to a generic bucket.
  }

  return "other";
}

function normalizeServiceCandidate(text: string) {
  const raw = cleanInlineText(text).replace(/\s+/g, " ").trim();
  const cleaned = raw
    .replace(/[|•]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9/&+ -]/g, "")
    .trim();

  if (!cleaned) return "";

  const lower = cleaned.toLowerCase();
  const wordCount = cleaned.split(/\s+/).length;

  if (wordCount > 6) return "";
  if (cleaned.length < 3 || cleaned.length > 50) return "";
  if (GENERIC_SERVICE_PHRASES.has(lower)) return "";
  if (EMAIL_REGEX.test(cleaned) || AU_PHONE_REGEX.test(cleaned)) return "";
  if (/<img|src=|cdn\/shop|data:image/i.test(raw)) return "";
  if (raw.length >= 8 && raw === raw.toUpperCase() && !/\b(menu|faq|gym|24\/7)\b/i.test(raw)) {
    return "";
  }
  if (/\b(australia|new zealand|united states|united kingdom|canada|singapore|ireland)\b/i.test(lower)) {
    return "";
  }
  if (/^(hello|hi|hey)\b/i.test(lower)) {
    return "";
  }
  if (/\b(click|learn|discover|read|view|call|contact|submit|book)\b/i.test(cleaned) && wordCount <= 2) {
    return "";
  }
  if (/^(find|view|learn|order|join|own|read|get|book|call|contact|meet)\b/i.test(lower)) {
    return "";
  }
  if (/\b(special offer|special offers|careers?|franchis|privacy|terms|policy|blog|stories?|community|loyalty|inspired)\b/i.test(lower)) {
    return "";
  }
  if (/\b(only in the app|why\b|find your|find a|order now|order here|view all|join the club|click collect|visit our|need it|get it|you can)\b/i.test(lower)) {
    return "";
  }
  if (/^(collect|delivered|delivery order here|click collect order here)$/i.test(lower)) {
    return "";
  }

  return toTitleCase(cleaned);
}

function collectServiceCandidates(pages: CrawledPage[]) {
  const scores = new Map<string, number>();

  for (const page of pages) {
    const pageScore = Math.max(scorePath(page.url), 1);
    const preferred =
      /service|offer|solution|treatment|menu|product|package|pricing|shop|trainer|training|membership|gym/i.test(
        `${page.url} ${page.title}`
      ) || page.url === pages[0]?.url;

    const items = [
      ...(page.title ? [{ text: page.title.split(/[-|•]/)[0] ?? page.title, weight: preferred ? 7 : 4 }] : []),
      ...page.headings.map((text) => ({ text, weight: preferred ? 4 : 2 })),
      ...page.listItems.map((text) => ({ text, weight: preferred ? 3 : 1 })),
      ...page.links.map((text) => ({ text, weight: preferred ? 4 : 2 }))
    ];

    for (const item of items) {
      const candidate = normalizeServiceCandidate(item.text);
      if (!candidate) continue;
      scores.set(candidate, (scores.get(candidate) ?? 0) + item.weight + pageScore);
    }
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([service]) => service)
    .filter((service, _, services) => {
      const lower = service.toLowerCase();

      if (lower === "menu" && services.some((candidate) => candidate !== service && /menu$/i.test(candidate))) {
        return false;
      }

      if (lower === "training" && services.some((candidate) => candidate !== service && /training$/i.test(candidate))) {
        return false;
      }

      return true;
    });

  return ranked.slice(0, 8);
}

function pickDescription(pages: CrawledPage[], fallbackBusinessName: string) {
  const candidates = unique(
    [
      pages[0]?.description,
      ...pages.flatMap((page) => page.paragraphs),
      ...pages.flatMap((page) => page.headings)
    ]
      .map((candidate) => normalizeSentenceText(candidate ?? ""))
      .filter(Boolean)
  );

  const best = candidates
    .map((candidate) => ({
      candidate,
      score: scoreDescriptionCandidate(candidate, fallbackBusinessName)
    }))
    .filter((entry) => Number.isFinite(entry.score))
    .sort((left, right) => right.score - left.score)[0]?.candidate;

  return best ?? `${fallbackBusinessName} is an Australian business.`;
}

function pickHours(pages: CrawledPage[]) {
  const text = pages.map((page) => page.text).join("\n");
  const fromStructured = pages.map((page) => page.hints.hours).find(Boolean);
  const fromText = text.match(
    /((?:\bmon\b|\bmonday\b|\btue\b|\btuesday\b|\bwed\b|\bwednesday\b|\bthu\b|\bthursday\b|\bfri\b|\bfriday\b|\bsat\b|\bsaturday\b|\bsun\b|\bsunday\b)[^.\n]{0,80}(?:\d|am|pm|closed|open|appointment)[^.\n]{0,80})/i
  )?.[1];

  return firstNonEmpty(fromStructured, fromText) || null;
}

function pickServiceArea(pages: CrawledPage[], homepageUrl: string) {
  const areaFromStructured = pages.map((page) => page.hints.serviceArea).find(Boolean);
  if (areaFromStructured) return areaFromStructured;

  const text = pages.map((page) => page.text).join("\n");
  const match =
    text.match(/(?:serving|service area|areas we serve|based in|located in)\s+([A-Z][A-Za-z\s,]{3,60})/i)?.[1] ??
    text.match(/\b(Australia|New Zealand|United States|United Kingdom|Canada|Singapore|Ireland)\b/i)?.[1];

  return firstNonEmpty(match, inferRegionalDefault(homepageUrl, text));
}

function buildKnowledgeText(pages: CrawledPage[]) {
  const chunks = pages.map((page, index) =>
    [
      `Page ${index + 1}: ${page.title || "Untitled page"}`,
      `URL: ${page.url}`,
      page.description ? `Summary: ${page.description}` : "",
      page.headings.length ? `Headings: ${page.headings.slice(0, 5).join(" | ")}` : "",
      `Content:\n${page.text}`
    ]
      .filter(Boolean)
      .join("\n")
  );

  return truncate(chunks.join("\n\n===\n\n"), MAX_KNOWLEDGE_CHARS);
}

async function fetchSitemapUrls(rootUrl: string, domain: string) {
  const sitemapUrl = new URL("/sitemap.xml", rootUrl).toString();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(sitemapUrl, {
        headers: {
          "accept": "application/xml,text/xml;q=0.9,*/*;q=0.1",
          "user-agent": USER_AGENT
        },
        cache: "no-store",
        signal: controller.signal
      });

      if (!response.ok) return [];
      const xml = await response.text();

      return unique(
        Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi))
          .map((match) => cleanInlineText(match[1] ?? ""))
          .filter(Boolean)
          .map((url) => {
            try {
              return canonicalizeUrl(url);
            } catch {
              return null;
            }
          })
          .filter((url): url is string => Boolean(url))
          .filter((url) => isSameDomain(url, domain))
      ).slice(0, 20);
    } finally {
      clearTimeout(timeout);
    }
  } catch {
    return [];
  }
}

async function crawlPageWithFetcher(url: string, fetchPage: PageFetcher): Promise<{
  page: CrawledPage;
  html: string;
} | null> {
  try {
    const { html, finalUrl } = await fetchPage(url);
    const title = firstNonEmpty(
      cleanInlineText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? ""),
      extractMetaContent(html, "property", "og:title")
    );
    const description = firstNonEmpty(
      extractMetaContent(html, "name", "description"),
      extractMetaContent(html, "property", "og:description")
    );
    const hints = extractStructuredHints(html);
    const linkedContact = extractLinkedContact(html);
    const pageText = extractPageText(html);

    if (detectBlockedPage(html, pageText.text)) {
      throw new Error("This website is blocking automated scans.");
    }

    if (!pageText.text.trim()) {
      return null;
    }

    return {
      html,
      page: {
        url: finalUrl,
        title,
        description,
        headings: pageText.headings,
        links: pageText.links,
        listItems: pageText.listItems,
        paragraphs: pageText.paragraphs,
        text: pageText.text,
        hints: {
          ...hints,
          phone: hints.phone ?? linkedContact.phone,
          email: hints.email ?? linkedContact.email
        }
      }
    };
  } catch {
    return null;
  }
}

function buildCandidateUrls(input: {
  homepageUrl: string;
  homepageHtml: string;
  domain: string;
  sitemapLinks: string[];
}) {
  const homepageLinks = extractLinks(input.homepageHtml, input.homepageUrl, input.domain);
  const localePrefix = getLocalePrefixPath(input.homepageUrl);
  const origin = new URL(input.homepageUrl).origin;
  const commonLinks = COMMON_PATHS.map((path) =>
    canonicalizeUrl(
      localePrefix ? (path === "/" ? localePrefix : `${localePrefix}${path}`) : path,
      origin
    )
  ).filter((candidate) => isSameDomain(candidate, input.domain));
  const homepageLinkSet = new Set(homepageLinks);
  const commonLinkSet = new Set(commonLinks);

  return unique([...homepageLinks, ...commonLinks, ...input.sitemapLinks])
    .filter((candidate) => candidate !== input.homepageUrl)
    .map((candidate, index) => ({
      candidate,
      index,
      kind: classifyCandidatePath(candidate),
      score:
        scorePath(candidate) +
        (commonLinkSet.has(candidate) ? 1 : 0) +
        (homepageLinkSet.has(candidate) ? 5 : 0)
    }))
    .filter((entry) => entry.score >= 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .reduce<string[]>((selected, entry, _, ranked) => {
      if (selected.length) {
        return selected;
      }

      const preferredKinds = ["service", "contact", "about"] as const;
      const seeded = preferredKinds
        .map((kind) => ranked.find((candidate) => candidate.kind === kind)?.candidate)
        .filter((candidate): candidate is string => Boolean(candidate));

      return unique([...seeded, ...ranked.map((candidate) => candidate.candidate)]).slice(0, MAX_PAGES - 1);
    }, []);
}

function buildWebsiteScanResult(input: {
  domain: string;
  homepageUrl: string;
  homepageHtml: string;
  pages: CrawledPage[];
  scanMethod: "browser" | "html";
  scanWarnings: string[];
}): WebsiteScanResult {
  const combinedText = input.pages
    .map((page) => [page.title, page.description, page.text].filter(Boolean).join("\n"))
    .join("\n\n")
    .trim();

  if (!combinedText) {
    throw new Error("We couldn't extract readable content from that website.");
  }

  const businessName = pickBusinessName(
    [
      extractMetaContent(input.homepageHtml, "property", "og:site_name"),
      input.pages[0]?.title.split(/[-|•]/)[0],
      input.pages[0]?.headings[0],
      ...input.pages.map((page) => page.hints.name),
      domainToBusinessName(input.domain)
    ],
    input.domain
  );

  const services = collectServiceCandidates(input.pages);
  const phone = firstNonEmpty(
    input.pages.map((page) => page.hints.phone).find(Boolean),
    combinedText.match(AU_PHONE_REGEX)?.[0]
  ) || null;
  const email = firstNonEmpty(
    input.pages.map((page) => page.hints.email).find(Boolean),
    combinedText.match(EMAIL_REGEX)?.[0]
  ) || null;
  const hours = pickHours(input.pages);
  const serviceArea = pickServiceArea(input.pages, input.homepageUrl);
  const description = pickDescription(input.pages, businessName);
  const keyInfo = [
    services.length ? `Services include ${services.slice(0, 4).join(", ")}` : "",
    phone ? `Phone ${phone}` : "",
    email ? `Email ${email}` : "",
    hours ? `Hours ${hours}` : ""
  ]
    .filter(Boolean)
    .join(". ");

  return {
    finalUrl: input.homepageUrl,
    domain: input.domain,
    sourceUrls: input.pages.map((page) => page.url),
    knowledgeText: buildKnowledgeText(input.pages),
    scanMethod: input.scanMethod,
    scanWarnings: input.scanWarnings,
    combinedText,
    businessName,
    services,
    serviceArea,
    phone,
    email,
    hours,
    description,
    keyInfo
  };
}

async function scanWebsiteWithFetcher(input: {
  url: string;
  fetchPage: PageFetcher;
  scanMethod: "browser" | "html";
  scanWarnings?: string[];
}): Promise<WebsiteScanResult> {
  const normalized = normalizeUrl(input.url);
  const requestedDomain = getDomain(normalized);

  const homepageResult = await crawlPageWithFetcher(normalized, input.fetchPage);
  if (!homepageResult) {
    throw new Error(
      "We couldn't read that website. It may be blocking server-side scans or returning no readable page content."
    );
  }

  const effectiveDomain = getDomain(homepageResult.page.url);
  const scanWarnings = [...(input.scanWarnings ?? [])];
  if (effectiveDomain !== requestedDomain) {
    scanWarnings.push(
      `The website redirected from ${requestedDomain} to ${effectiveDomain}, so AgentDrop followed the live destination domain.`
    );
  }

  const sitemapLinks = await fetchSitemapUrls(homepageResult.page.url, effectiveDomain);
  const candidateUrls = buildCandidateUrls({
    homepageUrl: homepageResult.page.url,
    homepageHtml: homepageResult.html,
    domain: effectiveDomain,
    sitemapLinks
  });

  const additionalResults: Array<{ page: CrawledPage; html: string }> = [];

  for (const candidate of candidateUrls) {
    const result = await crawlPageWithFetcher(candidate, input.fetchPage);
    if (result) {
      additionalResults.push(result);
    }
  }

  const pages = unique([homepageResult.page.url, ...additionalResults.map((result) => result.page.url)])
    .map((urlValue) =>
      [homepageResult.page, ...additionalResults.map((result) => result.page)].find(
        (page) => page.url === urlValue
      )
    )
    .filter((page): page is CrawledPage => Boolean(page))
    .slice(0, MAX_PAGES);

  return buildWebsiteScanResult({
    domain: effectiveDomain,
    homepageUrl: homepageResult.page.url,
    homepageHtml: homepageResult.html,
    pages,
    scanMethod: input.scanMethod,
    scanWarnings
  });
}

async function scanWebsiteWithHtml(url: string, scanWarnings: string[] = []) {
  return scanWebsiteWithFetcher({
    url,
    fetchPage: fetchHtmlPage,
    scanMethod: "html",
    scanWarnings
  });
}

export async function scanWebsite(url: string): Promise<WebsiteScanResult> {
  try {
    const browserSession = await createBrowserPageFetcher();

    try {
      return await scanWebsiteWithFetcher({
        url,
        fetchPage: browserSession.fetchPage,
        scanMethod: "browser"
      });
    } finally {
      await browserSession.close();
    }
  } catch (browserError) {
    const browserMessage =
      browserError instanceof Error ? browserError.message : "Browser-rendered scan unavailable.";

    return scanWebsiteWithHtml(url, [
      `Browser-rendered scan was unavailable, so AgentDrop used the HTML crawler instead.`,
      browserMessage
    ]);
  }
}
