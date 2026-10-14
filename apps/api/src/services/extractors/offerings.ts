import type {
  FetchedPageArtifact,
  OfferingsExtraction,
  PageMetadataExtraction
} from "@/apps/api/src/services/ingestionTypes";
import { cleanInlineText, unique } from "@/apps/api/src/services/extractors/utils";

const GENERIC_LABELS = new Set([
  "about",
  "about us",
  "contact",
  "contact us",
  "learn more",
  "read more",
  "home",
  "menu",
  "products",
  "services",
  "book now",
  "order now",
  "shop now",
  "view all",
  "login",
  "register",
  "main menu",
  "page links",
  "follow us",
  "skip to content",
  "facebook",
  "instagram",
  "tripadvisor",
  "mail",
  "design host",
  "home"
]);

function normalizeCandidate(value: string) {
  const cleaned = cleanInlineText(value)
    .replace(/[|•]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/[^a-zA-Z0-9/&+ -]/g, "")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length < 3 || cleaned.length > 60) return "";
  if (cleaned.split(/\s+/).length > 7) return "";
  if (GENERIC_LABELS.has(cleaned.toLowerCase())) return "";
  if (/^(book|contact|learn|read|view|get|shop|order)\b/i.test(cleaned)) return "";
  if (/^(phone|email|address)\b/i.test(cleaned)) return "";
  if (/^(terms|privacy|policy|cookies)\b/i.test(cleaned)) return "";

  return cleaned
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function collectFaqFromJsonLd(jsonLdEntities: Array<Record<string, unknown>>) {
  const entries: Array<{ question: string; answer: string }> = [];

  for (const entity of jsonLdEntities) {
    const entityType = String(entity["@type"] ?? "").toLowerCase();
    if (!entityType.includes("faqpage")) continue;

    const mainEntity = Array.isArray(entity.mainEntity) ? entity.mainEntity : [];
    for (const item of mainEntity) {
      if (!item || typeof item !== "object") continue;
      const record = item as Record<string, unknown>;
      const question = cleanInlineText(String(record.name ?? ""));
      const answerRecord =
        record.acceptedAnswer && typeof record.acceptedAnswer === "object"
          ? (record.acceptedAnswer as Record<string, unknown>)
          : null;
      const answer = cleanInlineText(String(answerRecord?.text ?? ""));
      if (question && answer) {
        entries.push({ question, answer });
      }
    }
  }

  return entries;
}

function collectFaqFromText(visibleText: string) {
  const lines = visibleText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const faq: Array<{ question: string; answer: string }> = [];

  for (let index = 0; index < lines.length - 1; index += 1) {
    const question = lines[index];
    const answer = lines[index + 1];

    if (question.endsWith("?") && answer && answer.length >= 20) {
      faq.push({
        question: cleanInlineText(question),
        answer: cleanInlineText(answer)
      });
    }
  }

  return faq.slice(0, 8);
}

export function extractOfferingSignals(
  page: FetchedPageArtifact,
  metadata: PageMetadataExtraction
): OfferingsExtraction {
  const candidates = unique(
    [
      metadata.title.split(/[-|•]/)[0] ?? metadata.title,
      ...metadata.headings,
      ...metadata.bodyLinks.map((link) => link.text),
      ...metadata.buttons
    ]
      .map(normalizeCandidate)
      .filter(Boolean)
  );

  const services = candidates
    .filter((value) =>
      /(service|consult|repair|install|clean|training|membership|menu|catering|support|booking|quote|solution|care|therapy|design|marketing|accounting|legal|fitness|class|delivery)/i.test(
        value
      ) ||
      /(parasail|parasailing|jet boat|jet boating|jet ski|jet skis|ride|rides|tour|tours|experience|experiences|watersport|water sport|package|packages|adventure)/i.test(
        value
      )
    )
    .slice(0, 12);

  const products = candidates
    .filter((value) =>
      /(product|shop|package|plan|item|collection|coffee|drink|menu|gift|membership|special|specials)/i.test(value)
    )
    .slice(0, 12);

  const categories = candidates.slice(0, 12);
  const priceSignals = unique(
    (metadata.visibleText.match(/\$\s?\d[\d,.]*(?:\s?(?:per|\/)\s?(?:month|week|item|service))?/gi) ?? [])
      .map((value) => cleanInlineText(value))
      .slice(0, 10)
  );

  const ctaText = `${metadata.ctaLabels.join(" ")} ${metadata.bodyLinks.map((link) => link.text).join(" ")}`.toLowerCase();
  const bookingSupported = /(book|schedule|reserve|appointment|consultation)/.test(ctaText);
  const quoteSupported = /(quote|estimate|get started|request)/.test(ctaText);
  const ecommerceSupported =
    /(cart|checkout|shop|buy|add to cart|order)/.test(ctaText) ||
    metadata.bodyLinks.some((link) => /(cart|checkout|product|shop)/i.test(link.url));
  const supportSupported =
    /(support|help|contact support|customer service|faq)/.test(ctaText) ||
    metadata.pageType === "faq";

  return {
    services,
    products,
    categories,
    priceSignals,
    faq: unique(
      [...collectFaqFromJsonLd(metadata.jsonLdEntities), ...collectFaqFromText(metadata.visibleText)].map(
        (item) => JSON.stringify(item)
      )
    )
      .map((item) => JSON.parse(item) as { question: string; answer: string })
      .slice(0, 12),
    testimonials: unique(
      metadata.visibleText
        .split("\n")
        .filter((line) => /testimonial|what our clients say|customer review/i.test(line))
        .slice(0, 6)
        .map((line) => cleanInlineText(line))
    ),
    reviewSignals: unique(
      metadata.visibleText
        .split("\n")
        .filter((line) => /\b\d(?:\.\d)?\s?(?:stars?|reviews?)\b/i.test(line))
        .slice(0, 8)
        .map((line) => cleanInlineText(line))
    ),
    certifications: unique(
      metadata.visibleText
        .split("\n")
        .filter((line) => /certified|licensed|insured|accredited/i.test(line))
        .slice(0, 8)
        .map((line) => cleanInlineText(line))
    ),
    guarantees: unique(
      metadata.visibleText
        .split("\n")
        .filter((line) => /guarantee|warranty|money back/i.test(line))
        .slice(0, 8)
        .map((line) => cleanInlineText(line))
    ),
    bookingSupported,
    quoteSupported,
    ecommerceSupported,
    supportSupported
  };
}
