export function getFriendlyProgressDetail(status: string) {
  switch (status) {
    case "queued":
      return "Getting everything ready.";
    case "validating_url":
    case "fetching_homepage":
      return "Taking the first look at your website.";
    case "discovering_pages":
    case "fetching_pages":
      return "Reading the pages that matter most.";
    case "rendering_pages":
    case "extracting_business_data":
      return "Turning what we found into your first agent draft.";
    case "building_profile":
    case "generating_agent":
      return "Adding the finishing touches to your preview.";
    case "completed":
      return "Your first agent draft is ready.";
    case "partial_success":
      return "Your draft is ready, with a few details worth reviewing.";
    case "failed":
      return "We hit a snag on this pass, but another try usually fixes it.";
    default:
      return "Building your agent.";
  }
}

function mapWarningToFriendlyCopy(warning: string) {
  const normalized = warning.toLowerCase();

  if (normalized.includes("rendered fallback used")) {
    return "";
  }

  if (normalized.includes("redirected from")) {
    return "";
  }

  if (normalized.includes("failed to analyze")) {
    return "A few pages were harder to read, so you may want to review the details.";
  }

  if (normalized.includes("timed out")) {
    return "Part of the website took too long to load, so this draft may need a quick review.";
  }

  if (normalized.includes("blocked") || normalized.includes("captcha") || normalized.includes("403")) {
    return "This website seems to block automated access on some pages.";
  }

  if (normalized.includes("no usable pages")) {
    return "We couldn't get enough usable content from the website on this pass.";
  }

  return "Some website details may need a quick review.";
}

export function summarizeWarnings(warnings: string[]) {
  const seen = new Set<string>();
  const summary: string[] = [];

  for (const warning of warnings) {
    const friendly = mapWarningToFriendlyCopy(warning);
    if (!friendly || seen.has(friendly)) {
      continue;
    }

    seen.add(friendly);
    summary.push(friendly);
  }

  return summary;
}
