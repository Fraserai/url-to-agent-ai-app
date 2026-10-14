import { URL } from "node:url";

import type { DiscoveredLink, ExtractedForm } from "@/apps/api/src/services/ingestionTypes";

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  nbsp: " ",
  quot: "\""
};

export function decodeHtmlEntities(text: string) {
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

export function cleanInlineText(text: string) {
  return decodeHtmlEntities(
    text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|section|article|h1|h2|h3|h4|h5|h6|a|button|nav|footer|header)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

export function unique<T>(items: T[]) {
  return Array.from(new Set(items));
}

export function truncate(text: string, limit: number) {
  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit - 1).trim()}…`;
}

export function extractMetaContent(html: string, key: string, attr: "name" | "property" = "name") {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${key}["'][^>]+content=["']([^"']+)["'][^>]*>`,
    "i"
  );

  return cleanInlineText(html.match(pattern)?.[1] ?? "");
}

export function extractTagContents(html: string, tag: string) {
  return Array.from(html.matchAll(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi")))
    .map((match) => cleanInlineText(match[1] ?? ""))
    .filter(Boolean);
}

export function absoluteUrl(input: string, baseUrl: string) {
  try {
    const url = new URL(input, baseUrl);
    url.hash = "";
    return url.toString();
  } catch {
    return "";
  }
}

export function extractLinks(
  html: string,
  baseUrl: string,
  section: "nav" | "footer" | "body" = "body"
): DiscoveredLink[] {
  const region =
    section === "nav"
      ? html.match(/<nav[\s\S]*?<\/nav>/i)?.[0] ?? ""
      : section === "footer"
        ? html.match(/<footer[\s\S]*?<\/footer>/i)?.[0] ?? ""
        : html;

  return Array.from(region.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi))
    .map((match) => {
      const url = absoluteUrl(match[1] ?? "", baseUrl);
      const text = cleanInlineText(match[2] ?? "");
      return {
        url,
        text,
        source: section
      } satisfies DiscoveredLink;
    })
    .filter((link) => Boolean(link.url))
    .filter((link) => !/^(mailto:|tel:|javascript:)/i.test(link.url))
    .filter((link) => !/\.(pdf|jpg|jpeg|png|gif|svg|webp|avif|zip|mp4|mov)(\?|$)/i.test(link.url))
    .filter((link) => !/(skip to content|main menu|page links|follow us)$/i.test(link.text));
}

export function extractCanonicalUrl(html: string, baseUrl: string) {
  const href = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1] ?? "";
  return absoluteUrl(href, baseUrl);
}

export function extractOpenGraphTags(html: string) {
  const tags = Array.from(
    html.matchAll(/<meta[^>]+property=["'](og:[^"']+)["'][^>]+content=["']([^"']+)["'][^>]*>/gi)
  );

  return tags.reduce<Record<string, string>>((accumulator, match) => {
    const key = cleanInlineText(match[1] ?? "");
    const value = cleanInlineText(match[2] ?? "");

    if (key && value) {
      accumulator[key] = value;
    }

    return accumulator;
  }, {});
}

export function extractJsonLdEntities(html: string) {
  const blocks = Array.from(
    html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)
  )
    .map((match) => match[1]?.trim())
    .filter(Boolean) as string[];

  return blocks.flatMap((block) => {
    try {
      const parsed = JSON.parse(block);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch {
      return [];
    }
  });
}

export function extractVisibleText(html: string, limit = 12000) {
  const mainRegion =
    html.match(/<main[\s\S]*?<\/main>/i)?.[0] ??
    html.match(/<body[\s\S]*?<\/body>/i)?.[0] ??
    html;

  const text = cleanInlineText(mainRegion);
  return truncate(text, limit);
}

export function extractForms(html: string, baseUrl: string): ExtractedForm[] {
  return Array.from(html.matchAll(/<form([^>]*)>([\s\S]*?)<\/form>/gi))
    .map((match) => {
      const attributes = match[1] ?? "";
      const body = match[2] ?? "";
      const action = absoluteUrl(
        attributes.match(/\saction=["']([^"']+)["']/i)?.[1] ?? "",
        baseUrl
      );
      const method = (attributes.match(/\smethod=["']([^"']+)["']/i)?.[1] ?? "get").toLowerCase();
      const fields = Array.from(
        body.matchAll(/<(input|textarea|select)[^>]+(?:name|id)=["']([^"']+)["'][^>]*>/gi)
      ).map((entry) => cleanInlineText(entry[2] ?? ""));

      return {
        action,
        method,
        fields: unique(fields).filter(Boolean)
      } satisfies ExtractedForm;
    })
    .filter((form) => form.fields.length > 0);
}

export function extractButtonLabels(html: string) {
  const buttons = extractTagContents(html, "button");
  const anchorButtons = Array.from(
    html.matchAll(/<a[^>]+class=["'][^"']*(?:btn|button|cta)[^"']*["'][^>]*>([\s\S]*?)<\/a>/gi)
  )
    .map((match) => cleanInlineText(match[1] ?? ""))
    .filter(Boolean);

  return unique([...buttons, ...anchorButtons])
    .map((value) => value.replace(/\s+/g, " ").trim())
    .filter((value) => value.length >= 2 && value.length <= 90);
}

export function extractImages(html: string, baseUrl: string) {
  return unique(
    Array.from(html.matchAll(/<(img|source)[^>]+(?:src|srcset)=["']([^"']+)["'][^>]*>/gi))
      .map((match) => absoluteUrl((match[2] ?? "").split(",")[0]?.trim() ?? "", baseUrl))
      .filter(Boolean)
  );
}

export function extractLogoCandidates(html: string, baseUrl: string) {
  const candidates = [
    ...Array.from(
      html.matchAll(/<img[^>]+(?:alt|class)=["'][^"']*(?:logo|brand)[^"']*["'][^>]+src=["']([^"']+)["']/gi)
    ).map((match) => absoluteUrl(match[1] ?? "", baseUrl)),
    absoluteUrl(extractMetaContent(html, "og:image", "property"), baseUrl)
  ];

  return unique(candidates.filter(Boolean));
}

export function domainOf(url: string) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return "";
  }
}
