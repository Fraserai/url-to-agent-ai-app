import type {
  FetchedPageArtifact,
  PageMetadataExtraction
} from "@/apps/api/src/services/ingestionTypes";
import {
  cleanInlineText,
  extractButtonLabels,
  extractCanonicalUrl,
  extractForms,
  extractImages,
  extractJsonLdEntities,
  extractLinks,
  extractLogoCandidates,
  extractMetaContent,
  extractOpenGraphTags,
  extractTagContents,
  extractVisibleText,
  truncate,
  unique
} from "@/apps/api/src/services/extractors/utils";

function inferPlatformHints(html: string, finalUrl: string) {
  const lower = `${html}\n${finalUrl}`.toLowerCase();
  return unique(
    [
      lower.includes("cdn.shopify.com") || lower.includes("shopify") ? "shopify" : "",
      lower.includes("wp-content") || lower.includes("wordpress") ? "wordpress" : "",
      lower.includes("squarespace") ? "squarespace" : "",
      lower.includes("wix") ? "wix" : "",
      lower.includes("webflow") ? "webflow" : "",
      lower.includes("__next") ? "nextjs" : ""
    ].filter(Boolean)
  );
}

function inferPageType(url: string) {
  const pathname = new URL(url).pathname.toLowerCase();

  if (pathname === "/" || pathname === "") return "homepage";
  if (pathname.includes("about")) return "about";
  if (pathname.includes("service")) return "services";
  if (pathname.includes("product")) return "products";
  if (pathname.includes("pricing")) return "pricing";
  if (pathname.includes("contact")) return "contact";
  if (pathname.includes("faq")) return "faq";
  if (pathname.includes("book")) return "booking";
  if (pathname.includes("quote")) return "quote";
  if (pathname.includes("location")) return "locations";
  if (pathname.includes("team")) return "team";
  if (pathname.includes("menu")) return "menu";
  if (pathname.includes("policy") || pathname.includes("privacy") || pathname.includes("terms") || pathname.includes("condition") || pathname.includes("ts-cs")) return "policy";
  return "general";
}

function extractImportantSnippets(html: string) {
  const raw = [
    ...extractTagContents(html, "h1"),
    ...extractTagContents(html, "h2"),
    ...extractTagContents(html, "p")
  ]
    .map((snippet) => snippet.replace(/\s+/g, " ").trim())
    .filter((snippet) => snippet.length >= 20 && snippet.length <= 220);

  return unique(raw).slice(0, 10).map((text, index) => ({
    label: index === 0 ? "hero" : "snippet",
    text
  }));
}

export function extractMetadataSignals(page: FetchedPageArtifact): PageMetadataExtraction {
  const html = page.html;
  const title = cleanInlineText(html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "");
  const metaDescription =
    extractMetaContent(html, "description") ||
    extractMetaContent(html, "og:description", "property");
  const openGraph = extractOpenGraphTags(html);
  const jsonLdEntities = extractJsonLdEntities(html);
  const headings = unique(
    extractTagContents(html, "h1")
      .concat(extractTagContents(html, "h2"))
      .concat(extractTagContents(html, "h3"))
  ).slice(0, 18);
  const navLinks = extractLinks(html, page.finalUrl, "nav");
  const footerLinks = extractLinks(html, page.finalUrl, "footer");
  const bodyLinks = extractLinks(html, page.finalUrl, "body").slice(0, 80);
  const buttons = extractButtonLabels(html);
  const forms = extractForms(html, page.finalUrl);
  const visibleText = extractVisibleText(html);
  const ctaLabels = unique(
    [...buttons, ...bodyLinks.map((link) => link.text)]
      .map((label) => label.replace(/\s+/g, " ").trim())
      .filter((label) => /(book|quote|contact|call|buy|shop|order|schedule|get started|join)/i.test(label))
  ).slice(0, 20);
  const images = extractImages(html, page.finalUrl).slice(0, 20);
  const logoCandidates = extractLogoCandidates(html, page.finalUrl).slice(0, 8);
  const language =
    html.match(/<html[^>]+lang=["']([^"']+)["']/i)?.[1] ??
    openGraph["og:locale"] ??
    "";

  return {
    title,
    metaDescription,
    canonicalUrl: extractCanonicalUrl(html, page.finalUrl),
    language,
    openGraph,
    jsonLdEntities,
    headings,
    navLinks,
    footerLinks,
    bodyLinks,
    buttons,
    ctaLabels,
    forms,
    images,
    logoCandidates,
    visibleText,
    importantSnippets: extractImportantSnippets(html).map((snippet) => ({
      ...snippet,
      text: truncate(snippet.text, 220)
    })),
    platformHints: inferPlatformHints(html, page.finalUrl),
    pageType: inferPageType(page.finalUrl)
  };
}
