export function normalizeUrl(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";

  try {
    const url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
    return url.toString();
  } catch {
    return trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  }
}

export function getDomain(input: string) {
  try {
    return new URL(normalizeUrl(input)).hostname.replace(/^www\./, "");
  } catch {
    return input.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] ?? input;
  }
}

export function domainToBusinessName(domain: string) {
  return domain
    .replace(/\.(com|com\.au|net|net\.au|org|org\.au|co|co\.uk|io|ai)$/i, "")
    .split(/[.\-]/g)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(" ");
}

