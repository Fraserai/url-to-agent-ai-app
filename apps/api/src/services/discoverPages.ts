import { ensureSafeTarget, normalizeUrl } from "@/apps/api/src/services/urlSafety";
import type { PageAnalysis } from "@/apps/api/src/services/ingestionTypes";
import { domainOf, unique } from "@/apps/api/src/services/extractors/utils";

const DEFAULT_PAGE_LIMIT = 15;
const HARD_CAP = 25;

const COMMON_PATHS = [
  "/about",
  "/about-us",
  "/services",
  "/service",
  "/products",
  "/pricing",
  "/contact",
  "/contact-us",
  "/faq",
  "/book",
  "/booking",
  "/quote",
  "/locations",
  "/team",
  "/menu"
];

export function scoreUrl(url: string): number {
  const path = new URL(url).pathname.toLowerCase();

  let score = 0;

  if (path === "/" || path === "") score += 100;
  if (path.includes("about")) score += 80;
  if (path.includes("service")) score += 75;
  if (path.includes("product")) score += 70;
  if (path.includes("pricing")) score += 65;
  if (path.includes("contact")) score += 70;
  if (path.includes("faq")) score += 65;
  if (path.includes("book")) score += 60;
  if (path.includes("quote")) score += 60;
  if (path.includes("location")) score += 55;
  if (path.includes("team")) score += 50;
  if (path.includes("menu")) score += 60;
  if (/(tour|ride|experience|activity|parasail|parasailing|jet-boat|jet-boating|jet-ski|jet-skis|package|special)/.test(path)) {
    score += 72;
  }
  if (path.includes("policy")) score += 20;

  if (path.includes("login")) score -= 100;
  if (path.includes("cart")) score -= 100;
  if (path.includes("account")) score -= 100;
  if (path.includes("tag")) score -= 40;
  if (path.includes("archive")) score -= 40;

  return score;
}

function scoreLinkText(text: string): number {
  const value = text.toLowerCase().trim();
  if (!value) return 0;

  let score = 0;
  if (/(contact|book|quote|faq|pricing|about|service|product|location|team|menu)/.test(value)) {
    score += 30;
  }
  if (/(tour|ride|experience|activity|parasail|parasailing|jet boat|jet boating|jet ski|jet skis|package|special)/.test(value)) {
    score += 65;
  }
  if (/(skip to content|main menu|page links|follow us|facebook|instagram|tripadvisor|design host|mail)/.test(value)) {
    score -= 90;
  }

  return score;
}

function scoreSource(source: "nav" | "footer" | "body" | "sitemap" | "common_path" | "wordpress") {
  switch (source) {
    case "nav":
      return 55;
    case "wordpress":
      return 52;
    case "sitemap":
      return 45;
    case "body":
      return 28;
    case "footer":
      return 18;
    case "common_path":
      return -30;
  }
}

function inferPageType(url: string) {
  const path = new URL(url).pathname.toLowerCase();

  if (path === "/" || !path) return "homepage";
  if (path.includes("about")) return "about";
  if (path.includes("service")) return "services";
  if (path.includes("product")) return "products";
  if (path.includes("pricing")) return "pricing";
  if (path.includes("contact")) return "contact";
  if (path.includes("faq")) return "faq";
  if (path.includes("book")) return "booking";
  if (path.includes("quote")) return "quote";
  if (path.includes("location")) return "locations";
  if (path.includes("team")) return "team";
  if (path.includes("menu")) return "menu";
  if (path.includes("policy") || path.includes("privacy") || path.includes("terms") || path.includes("condition") || path.includes("ts-cs")) return "policy";
  return "general";
}

async function fetchSitemapUrls(homepageUrl: string) {
  try {
    const sitemapUrl = new URL("/sitemap.xml", homepageUrl).toString();
    await ensureSafeTarget(sitemapUrl);
    const response = await fetch(sitemapUrl, {
      headers: {
        accept: "application/xml,text/xml;q=0.9,*/*;q=0.1"
      }
    });

    if (!response.ok) {
      return [];
    }

    const xml = await response.text();
    return unique(
      Array.from(xml.matchAll(/<loc>([\s\S]*?)<\/loc>/gi))
        .map((match) => normalizeUrl(match[1] ?? "").normalizedUrl)
        .filter(Boolean)
    );
  } catch {
    return [];
  }
}

async function fetchWordPressPageUrls(homepage: PageAnalysis) {
  if (!homepage.metadata.platformHints.includes("wordpress")) {
    return [];
  }

  try {
    const apiUrl = new URL("/wp-json/wp/v2/pages?per_page=100&_fields=link,title", homepage.artifact.finalUrl).toString();
    await ensureSafeTarget(apiUrl);

    const response = await fetch(apiUrl, {
      headers: {
        accept: "application/json,text/plain;q=0.9,*/*;q=0.1"
      }
    });

    if (!response.ok) {
      return [];
    }

    const payload = (await response.json()) as Array<{
      link?: string;
      title?: { rendered?: string };
    }>;

    return payload
      .map((page) => ({
        url: page.link ? normalizeUrl(page.link).normalizedUrl : "",
        text: page.title?.rendered ?? "",
        source: "wordpress" as const
      }))
      .filter((entry) => Boolean(entry.url));
  } catch {
    return [];
  }
}

function uniqueByCanonical<T extends { url: string }>(items: T[]) {
  const seen = new Set<string>();
  const output: T[] = [];

  for (const item of items) {
    const normalized = normalizeUrl(item.url);
    if (seen.has(normalized.canonicalKey)) {
      continue;
    }
    seen.add(normalized.canonicalKey);
    output.push({
      ...item,
      url: normalized.normalizedUrl
    });
  }

  return output;
}

export async function discoverPages(homepage: PageAnalysis, limit = DEFAULT_PAGE_LIMIT) {
  const homepageUrl = homepage.artifact.finalUrl;
  const homepageDomain = domainOf(homepageUrl);
  const baseUrl = new URL(homepageUrl).origin;
  const sitemapUrls = await fetchSitemapUrls(homepageUrl);
  const wordpressUrls = await fetchWordPressPageUrls(homepage);

  const explicitLinks = [
    ...homepage.metadata.navLinks,
    ...homepage.metadata.footerLinks,
    ...homepage.metadata.bodyLinks,
    ...sitemapUrls.map((url) => ({
      url,
      text: "",
      source: "sitemap" as const
    })),
    ...wordpressUrls
  ];

  const fallbackLinks =
    uniqueByCanonical(explicitLinks.filter((link) => link.url && domainOf(link.url) === homepageDomain))
      .length >= 8
      ? []
      : COMMON_PATHS.map((path) => ({
      url: normalizeUrl(new URL(path, baseUrl).toString()).normalizedUrl,
      text: "",
      source: "common_path" as const
    }));

  return uniqueByCanonical(
    [...explicitLinks, ...fallbackLinks]
      .filter((link) => link.url && domainOf(link.url) === homepageDomain)
      .filter((link) => !/\.xml(?:\?|$)/i.test(link.url))
      .filter((link) => !/[?&](?:page_id|replytocom|add-to-cart)=/i.test(link.url))
      .filter((link) => {
        const text = link.text.toLowerCase();
        return !/(skip to content|main menu|page links|follow us|facebook|instagram|tripadvisor|design host|mail)/.test(text);
      })
      .filter((link) => normalizeUrl(link.url).canonicalKey !== normalizeUrl(homepageUrl).canonicalKey)
  )
    .map((link) => ({
      url: link.url,
      score: scoreUrl(link.url) + scoreSource(link.source) + scoreLinkText(link.text),
      pageType: inferPageType(link.url)
    }))
    .filter((candidate) => candidate.score > -50)
    .sort((left, right) => right.score - left.score)
    .slice(0, Math.min(limit, HARD_CAP));
}
