export type CrawlWarning = string;

export type SourcePageEvidence = {
  url: string;
  finalUrl: string;
  title: string;
  pageType: string;
  fetchMode: "static" | "rendered";
  snippet: string;
};

export type JsonLdEntity = {
  type: string;
  name?: string;
  raw: Record<string, unknown>;
};

export type ImportantSnippet = {
  url: string;
  label: string;
  text: string;
};

export type BusinessContextObject = {
  site: {
    submitted_url: string;
    normalized_url: string;
    canonical_url: string;
    final_homepage_url: string;
    title: string;
    meta_description: string;
    language: string;
    platform_hints: string[];
    crawl_summary: {
      pages_attempted: number;
      pages_succeeded: number;
      pages_rendered: number;
      warnings: CrawlWarning[];
    };
  };
  business: {
    name: string;
    legal_name: string;
    industry: string;
    subindustry: string;
    business_type: string;
    summary: string;
    tone: string[];
    value_props: string[];
    audiences: string[];
    locations: string[];
    service_area: string[];
    hours: string[];
    contact: {
      phones: string[];
      emails: string[];
      addresses: string[];
      social_links: string[];
    };
  };
  offerings: {
    services: string[];
    products: string[];
    categories: string[];
    price_signals: string[];
    booking_supported: boolean;
    quote_supported: boolean;
    ecommerce_supported: boolean;
    support_supported: boolean;
  };
  conversion: {
    primary_conversion_type:
      | "lead"
      | "booking"
      | "support"
      | "quote"
      | "checkout"
      | "product_guidance";
    cta_labels: string[];
    forms: Array<{
      action: string;
      method: string;
      fields: string[];
    }>;
    calendar_links: string[];
    booking_links: string[];
    checkout_links: string[];
  };
  trust: {
    testimonials: string[];
    review_signals: string[];
    client_logos: string[];
    certifications: string[];
    guarantees: string[];
  };
  policies: {
    faq: Array<{
      question: string;
      answer: string;
    }>;
    returns: string;
    refunds: string;
    shipping: string;
    cancellation: string;
    privacy: string;
    terms: string;
  };
  brand: {
    logo_url: string;
    image_urls: string[];
    primary_colors: string[];
    secondary_colors: string[];
    font_families: string[];
    style_notes: string[];
  };
  evidence: {
    source_pages: SourcePageEvidence[];
    jsonld_entities: JsonLdEntity[];
    og_tags: Record<string, string>;
    important_snippets: ImportantSnippet[];
  };
};
