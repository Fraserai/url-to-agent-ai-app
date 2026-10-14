import type {
  BrandExtraction,
  FetchedPageArtifact,
  PageMetadataExtraction
} from "@/apps/api/src/services/ingestionTypes";
import { unique } from "@/apps/api/src/services/extractors/utils";

export function extractBrandSignals(
  page: FetchedPageArtifact,
  metadata: PageMetadataExtraction
): BrandExtraction {
  const colors = unique(page.renderSignals?.colors ?? []).slice(0, 8);
  const fonts = unique(page.renderSignals?.fonts ?? []).slice(0, 6);
  const images = unique([...(page.renderSignals?.imageUrls ?? []), ...metadata.images]).slice(0, 20);
  const logoUrl = metadata.logoCandidates[0] ?? metadata.openGraph["og:image"] ?? images[0] ?? "";

  return {
    logoUrl,
    imageUrls: images,
    primaryColors: colors.slice(0, 3),
    secondaryColors: colors.slice(3, 6),
    fontFamilies: fonts,
    styleNotes: unique(
      [
        ...(page.renderSignals?.styleNotes ?? []),
        metadata.openGraph["og:site_name"] ? "Open Graph site branding detected." : "",
        logoUrl ? "Logo candidate captured." : ""
      ].filter(Boolean)
    )
  };
}

