import type { PageAnalysis } from "@/apps/api/src/services/ingestionTypes";
import type { BusinessContextObject } from "@/packages/shared/src/types/businessContext";
import { cleanInlineText, truncate, unique } from "@/apps/api/src/services/extractors/utils";

const GENERIC_OFFERING_LABELS = new Set([
  "the experience",
  "home",
  "main menu",
  "page links",
  "follow us",
  "contact us",
  "what you get with us",
  "we provide",
  "what to bring"
]);

const CANONICAL_OFFERING_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
  {
    pattern: /^(?:[a-z]+\s){0,3}(?:parasail|parasailing)$/,
    label: "Parasailing"
  },
  {
    pattern: /^(?:[a-z]+\s){0,3}(?:jet boat|jet boating)$/,
    label: "Jet Boating"
  },
  {
    pattern: /^(?:[a-z]+\s){0,3}(?:jet ski|jet skis)$/,
    label: "Jet Skis"
  },
  {
    pattern: /^(?:[a-z]+\s){0,3}packages?$/,
    label: "Packages"
  },
  {
    pattern: /^(?:[a-z]+\s){0,3}specials?$/,
    label: "Specials"
  }
];

function pickBusinessName(pages: PageAnalysis[]) {
  for (const page of pages) {
    for (const entity of page.metadata.jsonLdEntities) {
      const type = String(entity["@type"] ?? "").toLowerCase();
      const name = typeof entity.name === "string" ? cleanInlineText(entity.name) : "";
      if (name && /(organization|localbusiness|store|restaurant|service|professionalservice|medicalbusiness)/.test(type)) {
        return name;
      }
    }
  }

  const ogSiteName = pages.find((page) => page.metadata.openGraph["og:site_name"])?.metadata.openGraph["og:site_name"];
  if (ogSiteName) return ogSiteName;

  const firstHeading = pages.find((page) => page.metadata.headings[0])?.metadata.headings[0];
  if (firstHeading) return firstHeading;

  const titled = pages[0]?.metadata.title.split(/[-|•]/)[0]?.trim();
  return titled || "Unknown business";
}

function inferTone(summary: string, ctas: string[]) {
  const text = `${summary} ${ctas.join(" ")}`.toLowerCase();
  const tone = [
    /luxury|premium|bespoke|elevated/.test(text) ? "premium" : "",
    /friendly|welcome|community|family/.test(text) ? "friendly" : "",
    /trusted|professional|expert|certified/.test(text) ? "professional" : "",
    /fast|quick|same day|efficient/.test(text) ? "efficient" : "",
    /book|buy|shop|order/.test(text) ? "sales-oriented" : ""
  ].filter(Boolean);

  return tone.length ? tone : ["helpful", "professional"];
}

function inferIndustry(services: string[], products: string[], ctas: string[]) {
  const text = `${services.join(" ")} ${products.join(" ")} ${ctas.join(" ")}`.toLowerCase();

  if (/(parasail|parasailing|jet boat|jet boating|jet ski|jet skis|ride|tour|experience|watersport|water sport|adventure)/.test(text)) {
    return {
      industry: "Tours & Experiences",
      subindustry: "Adventure Activities",
      businessType: "tour_operator"
    };
  }

  if (/(menu|drink|coffee|restaurant|catering|food|bar|cafe)/.test(text)) {
    return {
      industry: "Hospitality",
      subindustry: "Cafe / Restaurant",
      businessType: "local_consumer_business"
    };
  }

  if (/(fitness|training|gym|membership|class|personal trainer)/.test(text)) {
    return {
      industry: "Fitness & Wellness",
      subindustry: "Gym / Training",
      businessType: "membership_service_business"
    };
  }

  if (/(quote|estimate|repair|install|clean|service|consult)/.test(text)) {
    return {
      industry: "Services",
      subindustry: "Service Business",
      businessType: "service_business"
    };
  }

  if (/(product|shop|cart|checkout|buy|collection)/.test(text)) {
    return {
      industry: "Retail & Commerce",
      subindustry: "E-commerce",
      businessType: "product_business"
    };
  }

  return {
    industry: "Local Business",
    subindustry: "General Business",
    businessType: "general_business"
  };
}

function inferPrimaryConversion(pages: PageAnalysis[]) {
  const ctaText = pages.flatMap((page) => page.metadata.ctaLabels).join(" ").toLowerCase();

  if (/(book|schedule|reserve|appointment)/.test(ctaText)) return "booking";
  if (/(quote|estimate)/.test(ctaText)) return "quote";
  if (/(cart|checkout|buy|order)/.test(ctaText)) return "checkout";
  if (/(support|help|faq)/.test(ctaText)) return "support";
  if (/(product|compare|find the right)/.test(ctaText)) return "product_guidance";
  return "lead";
}

function formatNaturalList(values: string[]) {
  if (!values.length) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} and ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, and ${values.at(-1)}`;
}

function looksLikeStrongSummary(value: string) {
  const cleaned = cleanInlineText(value);
  return cleaned.length >= 60 && /[.!?]$/.test(cleaned);
}

function buildSummary(name: string, snippets: string[], metaDescription: string, services: string[]) {
  const preferred = cleanInlineText(metaDescription || snippets.find((snippet) => snippet.length >= 50) || "");
  if (preferred && looksLikeStrongSummary(preferred)) {
    return truncate(preferred, 320);
  }

  if (services.length) {
    return `${name} offers ${formatNaturalList(services.slice(0, 4))}.`;
  }

  if (preferred) {
    return truncate(preferred, 320);
  }

  return `${name} has a website with information about its business, services, and next steps for customers.`;
}

function inferServiceArea(summary: string, addresses: string[], locationLinks: string[]) {
  const text = `${summary} ${locationLinks.join(" ")}`;

  const explicit = text.match(
    /\b(Australia-wide|Australia wide|Australia|New Zealand|United Kingdom|United States|Canada|Singapore)\b/i
  )?.[1];

  if (explicit) {
    return [explicit.replace(/-wide/i, "").trim()];
  }

  if (addresses.length) {
    return addresses;
  }

  return locationLinks.slice(0, 6);
}

function formatDisplayLabel(value: string) {
  const cleaned = cleanInlineText(value).replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  if (/^[A-Z0-9 '&/+-]+$/.test(cleaned)) {
    return cleaned
      .toLowerCase()
      .split(/\s+/)
      .map((part) => {
        if (part === "&") return "&";
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(" ");
  }

  return cleaned;
}

function canonicalizeOfferingLabel(value: string) {
  const normalized = value.toLowerCase();

  for (const entry of CANONICAL_OFFERING_PATTERNS) {
    if (entry.pattern.test(normalized)) {
      return entry.label;
    }
  }

  return value;
}

function cleanOfferingList(values: string[], businessName: string) {
  const businessTokens = unique(
    businessName
      .toLowerCase()
      .split(/[^a-z0-9]+/g)
      .filter((token) => token.length >= 3)
  );
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const formatted = canonicalizeOfferingLabel(formatDisplayLabel(value));
    const normalized = formatted.toLowerCase();

    if (!formatted || GENERIC_OFFERING_LABELS.has(normalized)) {
      continue;
    }

    if (normalized === businessName.toLowerCase()) {
      continue;
    }

    const tokens = unique(normalized.split(/[^a-z0-9]+/g).filter((token) => token.length >= 3));
    const overlap = tokens.filter((token) => businessTokens.includes(token)).length;
    if (overlap >= Math.min(3, businessTokens.length) && !/(parasail|parasailing|jet boat|jet boating|jet ski|jet skis|packages|specials)/.test(normalized)) {
      continue;
    }

    const key = normalized.replace(/\band\b/g, "").replace(/\s+/g, " ").trim();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(formatted);
  }

  return output;
}

export function buildBusinessContext(input: {
  submittedUrl: string;
  normalizedUrl: string;
  canonicalKey: string;
  homepage: PageAnalysis;
  pages: PageAnalysis[];
  warnings: string[];
}): BusinessContextObject {
  const pages = input.pages;
  const homepage = input.homepage;
  const allSnippets = unique(
    pages.flatMap((page) => page.metadata.importantSnippets.map((snippet) => snippet.text))
  );
  const allServices = unique(pages.flatMap((page) => page.offerings.services)).slice(0, 16);
  const allProducts = unique(pages.flatMap((page) => page.offerings.products)).slice(0, 16);
  const allCategories = unique(pages.flatMap((page) => page.offerings.categories)).slice(0, 16);
  const allCtas = unique(pages.flatMap((page) => page.metadata.ctaLabels)).slice(0, 20);
  const allForms = unique(
    pages.flatMap((page) =>
      page.metadata.forms.map((form) =>
        JSON.stringify({
          action: form.action,
          method: form.method,
          fields: form.fields
        })
      )
    )
  ).map((form) => JSON.parse(form) as { action: string; method: string; fields: string[] });
  const name = pickBusinessName(pages);
  const cleanedServices = cleanOfferingList(allServices, name).slice(0, 12);
  const cleanedProducts = cleanOfferingList(allProducts, name).slice(0, 12);
  const cleanedCategories = cleanOfferingList(allCategories, name).slice(0, 16);
  const summary = buildSummary(
    name,
    allSnippets,
    homepage.metadata.metaDescription || homepage.metadata.openGraph["og:description"] || "",
    cleanedServices
  );
  const industry = inferIndustry(cleanedServices, cleanedProducts, allCtas);
  const primaryConversion = inferPrimaryConversion(pages);
  const phones = unique(pages.flatMap((page) => page.contact.phones)).slice(0, 10);
  const emails = unique(pages.flatMap((page) => page.contact.emails)).slice(0, 10);
  const addresses = unique(pages.flatMap((page) => page.contact.addresses)).slice(0, 10);
  const socialLinks = unique(pages.flatMap((page) => page.contact.socialLinks)).slice(0, 12);
  const hours = unique(pages.flatMap((page) => page.contact.hours)).slice(0, 12);
  const locationLinks = unique(
    pages.flatMap((page) =>
      page.metadata.bodyLinks
        .filter((link) => /location|store|visit|suburb|area/i.test(link.text))
        .map((link) => link.text)
    )
  );
  const brandLogo = pages.find((page) => page.brand.logoUrl)?.brand.logoUrl ?? "";
  const primaryColors = unique(pages.flatMap((page) => page.brand.primaryColors)).slice(0, 4);
  const secondaryColors = unique(pages.flatMap((page) => page.brand.secondaryColors)).slice(0, 4);
  const fontFamilies = unique(pages.flatMap((page) => page.brand.fontFamilies)).slice(0, 6);
  const imageUrls = unique(pages.flatMap((page) => page.brand.imageUrls)).slice(0, 20);
  const faq = unique(
    pages.flatMap((page) => page.offerings.faq.map((item) => JSON.stringify(item)))
  )
    .map((item) => JSON.parse(item) as { question: string; answer: string })
    .slice(0, 10);

  return {
    site: {
      submitted_url: input.submittedUrl,
      normalized_url: input.normalizedUrl,
      canonical_url: homepage.metadata.canonicalUrl || input.normalizedUrl,
      final_homepage_url: homepage.artifact.finalUrl,
      title: homepage.metadata.title,
      meta_description: homepage.metadata.metaDescription,
      language: homepage.metadata.language || "en",
      platform_hints: unique(pages.flatMap((page) => page.metadata.platformHints)),
      crawl_summary: {
        pages_attempted: pages.length,
        pages_succeeded: pages.length,
        pages_rendered: pages.filter((page) => page.artifact.wasRendered).length,
        warnings: input.warnings
      }
    },
    business: {
      name,
      legal_name: "",
      industry: industry.industry,
      subindustry: industry.subindustry,
      business_type: industry.businessType,
      summary,
      tone: inferTone(summary, allCtas),
      value_props: allSnippets.slice(0, 6),
      audiences: unique(
        allSnippets
          .filter((snippet) => /famil(y|ies)|business|homeowners|patients|members|customers|clients|teams/i.test(snippet))
          .slice(0, 6)
      ),
      locations: addresses,
      service_area: inferServiceArea(summary, addresses, locationLinks),
      hours,
      contact: {
        phones,
        emails,
        addresses,
        social_links: socialLinks
      }
    },
    offerings: {
      services: cleanedServices,
      products: cleanedProducts,
      categories: cleanedCategories,
      price_signals: unique(pages.flatMap((page) => page.offerings.priceSignals)).slice(0, 12),
      booking_supported: pages.some((page) => page.offerings.bookingSupported),
      quote_supported: pages.some((page) => page.offerings.quoteSupported),
      ecommerce_supported: pages.some((page) => page.offerings.ecommerceSupported),
      support_supported: pages.some((page) => page.offerings.supportSupported)
    },
    conversion: {
      primary_conversion_type: primaryConversion,
      cta_labels: allCtas,
      forms: allForms,
      calendar_links: pages.flatMap((page) =>
        page.metadata.bodyLinks
          .filter((link) => /calendly|calendar|acuityscheduling/i.test(link.url))
          .map((link) => link.url)
      ),
      booking_links: unique(
        pages.flatMap((page) =>
          page.metadata.bodyLinks
            .filter((link) => /book|schedule|reserve|appointment/i.test(`${link.text} ${link.url}`))
            .map((link) => link.url)
        )
      ).slice(0, 12),
      checkout_links: unique(
        pages.flatMap((page) =>
          page.metadata.bodyLinks
            .filter((link) => /checkout|cart|shop|buy|product/i.test(link.url))
            .map((link) => link.url)
        )
      ).slice(0, 12)
    },
    trust: {
      testimonials: unique(pages.flatMap((page) => page.offerings.testimonials)).slice(0, 10),
      review_signals: unique(pages.flatMap((page) => page.offerings.reviewSignals)).slice(0, 10),
      client_logos: [],
      certifications: unique(pages.flatMap((page) => page.offerings.certifications)).slice(0, 10),
      guarantees: unique(pages.flatMap((page) => page.offerings.guarantees)).slice(0, 10)
    },
    policies: {
      faq,
      returns: allSnippets.find((snippet) => /return/i.test(snippet)) ?? "",
      refunds: allSnippets.find((snippet) => /refund/i.test(snippet)) ?? "",
      shipping: allSnippets.find((snippet) => /shipping|delivery/i.test(snippet)) ?? "",
      cancellation: allSnippets.find((snippet) => /cancel/i.test(snippet)) ?? "",
      privacy: pages.find((page) => page.metadata.pageType === "policy" && /privacy/i.test(page.metadata.title))?.metadata.visibleText.slice(0, 300) ?? "",
      terms: pages.find((page) => page.metadata.pageType === "policy" && /terms/i.test(page.metadata.title))?.metadata.visibleText.slice(0, 300) ?? ""
    },
    brand: {
      logo_url: brandLogo,
      image_urls: imageUrls,
      primary_colors: primaryColors,
      secondary_colors: secondaryColors,
      font_families: fontFamilies,
      style_notes: unique(pages.flatMap((page) => page.brand.styleNotes)).slice(0, 10)
    },
    evidence: {
      source_pages: pages.map((page) => ({
        url: page.artifact.url,
        finalUrl: page.artifact.finalUrl,
        title: page.metadata.title,
        pageType: page.metadata.pageType,
        fetchMode: page.artifact.fetchMode,
        snippet: page.metadata.importantSnippets[0]?.text ?? truncate(page.metadata.visibleText, 180)
      })),
      jsonld_entities: pages.flatMap((page) =>
        page.metadata.jsonLdEntities.slice(0, 8).map((entity) => ({
          type: String(entity["@type"] ?? "Unknown"),
          name: typeof entity.name === "string" ? entity.name : undefined,
          raw: entity
        }))
      ),
      og_tags: Object.assign({}, ...pages.map((page) => page.metadata.openGraph)),
      important_snippets: pages.flatMap((page) =>
        page.metadata.importantSnippets.slice(0, 3).map((snippet) => ({
          url: page.artifact.finalUrl,
          label: snippet.label,
          text: snippet.text
        }))
      )
    }
  };
}
