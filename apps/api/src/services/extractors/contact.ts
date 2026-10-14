import type {
  ContactExtraction,
  FetchedPageArtifact,
  PageMetadataExtraction
} from "@/apps/api/src/services/ingestionTypes";
import { cleanInlineText, unique } from "@/apps/api/src/services/extractors/utils";

const PHONE_REGEX =
  /(?:\+?\d{1,3}[\s.-]?)?(?:\(?\d{2,4}\)?[\s.-]?)?\d{3,4}[\s.-]?\d{3,4}/g;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const SOCIAL_HOSTS = [
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "x.com",
  "twitter.com"
];

function extractHoursFromJsonLd(entities: Array<Record<string, unknown>>) {
  const hours: string[] = [];

  for (const entity of entities) {
    if (typeof entity.openingHours === "string") {
      hours.push(cleanInlineText(entity.openingHours));
    }

    const openingHoursSpecification = entity.openingHoursSpecification;
    if (Array.isArray(openingHoursSpecification)) {
      for (const item of openingHoursSpecification) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const day = Array.isArray(record.dayOfWeek)
          ? record.dayOfWeek.map((value) => String(value).split("/").pop() ?? String(value)).join(", ")
          : typeof record.dayOfWeek === "string"
            ? String(record.dayOfWeek).split("/").pop() ?? String(record.dayOfWeek)
            : "";
        const opens = typeof record.opens === "string" ? record.opens : "";
        const closes = typeof record.closes === "string" ? record.closes : "";
        const value = [day, opens && closes ? `${opens}-${closes}` : ""].filter(Boolean).join(" ");
        if (value) hours.push(cleanInlineText(value));
      }
    }
  }

  return unique(hours).filter(Boolean);
}

function extractAddressesFromJsonLd(entities: Array<Record<string, unknown>>) {
  const addresses: string[] = [];

  for (const entity of entities) {
    const address = entity.address;
    if (!address || typeof address !== "object") continue;

    const record = address as Record<string, unknown>;
    const formatted = [
      typeof record.streetAddress === "string" ? record.streetAddress : "",
      typeof record.addressLocality === "string" ? record.addressLocality : "",
      typeof record.addressRegion === "string" ? record.addressRegion : "",
      typeof record.postalCode === "string" ? record.postalCode : "",
      typeof record.addressCountry === "string" ? record.addressCountry : ""
    ]
      .filter(Boolean)
      .join(", ");

    if (formatted) {
      addresses.push(cleanInlineText(formatted));
    }
  }

  return unique(addresses);
}

function extractPhonesFromJsonLd(entities: Array<Record<string, unknown>>) {
  return unique(
    entities
      .map((entity) => (typeof entity.telephone === "string" ? cleanInlineText(entity.telephone) : ""))
      .filter(Boolean)
      .map((value) => value.replace(/[^\d+\s()-]/g, "").trim())
      .filter((value) => value.length >= 6 && value.length <= 24)
  );
}

function extractEmailsFromJsonLd(entities: Array<Record<string, unknown>>) {
  return unique(
    entities
      .map((entity) => (typeof entity.email === "string" ? cleanInlineText(entity.email) : ""))
      .filter(Boolean)
  );
}

function isUsefulAddress(value: string) {
  return /\d+\s+[A-Za-z0-9.' -]+\b(?:Street|St|Road|Rd|Lane|Ln|Drive|Dr|Avenue|Ave|Boulevard|Blvd|Way|Court|Ct)\b/i.test(
    value
  );
}

function normalizePhone(value: string) {
  const cleaned = value.replace(/[^\d+\s()-]/g, "").trim();
  const digits = cleaned.replace(/\D+/g, "");

  if (/^13\d{4}$/.test(digits)) {
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }

  if (/^1300\d{6}$/.test(digits)) {
    return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`;
  }

  return cleaned;
}

export function extractContactSignals(
  page: FetchedPageArtifact,
  metadata: PageMetadataExtraction
): ContactExtraction {
  const html = page.html;
  const jsonLdEntities = metadata.jsonLdEntities;
  const phones = unique(
    [
      ...extractPhonesFromJsonLd(jsonLdEntities),
      ...Array.from(html.matchAll(/href=["']tel:([^"'?#]+)[^"']*["']/gi)).map((match) =>
        cleanInlineText(match[1] ?? "")
      ),
      ...(metadata.visibleText.match(PHONE_REGEX) ?? []).map((value) => cleanInlineText(value))
    ]
      .map(normalizePhone)
      .filter((value) => {
        const digits = value.replace(/\D+/g, "");
        return digits.length >= 6 && digits.length <= 20;
      })
  );

  const emails = unique(
    [
      ...extractEmailsFromJsonLd(jsonLdEntities),
      ...Array.from(html.matchAll(/href=["']mailto:([^"'?#]+)[^"']*["']/gi)).map((match) =>
        cleanInlineText(match[1] ?? "")
      ),
      ...(metadata.visibleText.match(EMAIL_REGEX) ?? []).map((value) => cleanInlineText(value))
    ].filter(Boolean)
  );

  const socialLinks = unique(
    metadata.bodyLinks
      .map((link) => link.url)
      .filter((link) => SOCIAL_HOSTS.some((host) => link.includes(host)))
  );

  const hours = unique([
    ...extractHoursFromJsonLd(jsonLdEntities),
    ...(metadata.visibleText.match(
      /((?:mon|monday|tue|tuesday|wed|wednesday|thu|thursday|fri|friday|sat|saturday|sun|sunday)[^.\n]{0,80}(?:\d{1,2}(?::\d{2})?\s?(?:am|pm)|closed|open|24\/7)[^.\n]{0,40})/gi
    ) ?? [])
      .map((value) => cleanInlineText(value))
      .slice(0, 4)
  ]).filter(Boolean);

  const addresses = unique([
    ...extractAddressesFromJsonLd(jsonLdEntities),
    ...(
      metadata.visibleText.match(
        /\b\d{1,5}\s+[A-Za-z0-9.' -]+(?:Street|St|Road|Rd|Lane|Ln|Drive|Dr|Avenue|Ave|Boulevard|Blvd|Way|Court|Ct)\b[^\n]{0,80}/gi
      ) ?? []
    ).map((value) => cleanInlineText(value))
  ]).filter((value) => isUsefulAddress(value));

  return {
    phones,
    emails,
    addresses,
    socialLinks,
    hours
  };
}
