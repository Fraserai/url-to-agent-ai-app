import type { CrawledPageRecord } from "@/packages/shared/src/types/ingestion";

export type NormalizedUrl = {
  inputUrl: string;
  normalizedUrl: string;
  effectiveHostname: string;
  scheme: "http" | "https";
  canonicalKey: string;
};

export type FetchMode = "static" | "rendered";

export type DiscoveredLink = {
  url: string;
  text: string;
  source: "nav" | "footer" | "body" | "sitemap" | "common_path" | "wordpress";
};

export type ExtractedForm = {
  action: string;
  method: string;
  fields: string[];
};

export type RenderSignals = {
  colors: string[];
  fonts: string[];
  imageUrls: string[];
  styleNotes: string[];
};

export type FetchedPageArtifact = {
  url: string;
  finalUrl: string;
  statusCode: number;
  fetchMode: FetchMode;
  wasRendered: boolean;
  html: string;
  contentType: string;
  fetchWarnings: string[];
  renderSignals?: RenderSignals;
};

export type PageMetadataExtraction = {
  title: string;
  metaDescription: string;
  canonicalUrl: string;
  language: string;
  openGraph: Record<string, string>;
  jsonLdEntities: Array<Record<string, unknown>>;
  headings: string[];
  navLinks: DiscoveredLink[];
  footerLinks: DiscoveredLink[];
  bodyLinks: DiscoveredLink[];
  buttons: string[];
  ctaLabels: string[];
  forms: ExtractedForm[];
  images: string[];
  logoCandidates: string[];
  visibleText: string;
  importantSnippets: Array<{
    label: string;
    text: string;
  }>;
  platformHints: string[];
  pageType: string;
};

export type ContactExtraction = {
  phones: string[];
  emails: string[];
  addresses: string[];
  socialLinks: string[];
  hours: string[];
};

export type OfferingsExtraction = {
  services: string[];
  products: string[];
  categories: string[];
  priceSignals: string[];
  faq: Array<{
    question: string;
    answer: string;
  }>;
  testimonials: string[];
  reviewSignals: string[];
  certifications: string[];
  guarantees: string[];
  bookingSupported: boolean;
  quoteSupported: boolean;
  ecommerceSupported: boolean;
  supportSupported: boolean;
};

export type BrandExtraction = {
  logoUrl: string;
  imageUrls: string[];
  primaryColors: string[];
  secondaryColors: string[];
  fontFamilies: string[];
  styleNotes: string[];
};

export type PageAnalysis = {
  artifact: FetchedPageArtifact;
  metadata: PageMetadataExtraction;
  contact: ContactExtraction;
  offerings: OfferingsExtraction;
  brand: BrandExtraction;
};

export type PersistedPageAnalysis = CrawledPageRecord & {
  analysis?: PageAnalysis;
};
