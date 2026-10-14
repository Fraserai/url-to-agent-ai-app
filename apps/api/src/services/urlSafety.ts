import dns from "node:dns/promises";
import net from "node:net";

import type { NormalizedUrl } from "@/apps/api/src/services/ingestionTypes";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "gclid",
  "fbclid"
];

const BLOCKED_IPV4_RANGES: Array<[number, number]> = [
  [ipToInt("127.0.0.0"), ipToInt("127.255.255.255")],
  [ipToInt("10.0.0.0"), ipToInt("10.255.255.255")],
  [ipToInt("172.16.0.0"), ipToInt("172.31.255.255")],
  [ipToInt("192.168.0.0"), ipToInt("192.168.255.255")],
  [ipToInt("169.254.0.0"), ipToInt("169.254.255.255")],
  [ipToInt("0.0.0.0"), ipToInt("0.255.255.255")]
];

function ipToInt(ip: string) {
  return ip.split(".").reduce((sum, octet) => (sum << 8) + Number.parseInt(octet, 10), 0);
}

function isPrivateIpv4(ip: string) {
  const numeric = ipToInt(ip);
  return BLOCKED_IPV4_RANGES.some(([start, end]) => numeric >= start && numeric <= end);
}

function isBlockedIpv6(ip: string) {
  const normalized = ip.toLowerCase();
  return (
    normalized === "::1" ||
    normalized.startsWith("fe80:") ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized === "::" ||
    normalized.includes("::ffff:127.") ||
    normalized.includes("::ffff:10.") ||
    normalized.includes("::ffff:192.168.")
  );
}

function isBlockedHostname(hostname: string) {
  const lower = hostname.toLowerCase();
  return (
    lower === "localhost" ||
    lower.endsWith(".localhost") ||
    lower === "metadata.google.internal" ||
    lower === "169.254.169.254"
  );
}

export function normalizeUrl(input: string): NormalizedUrl {
  const trimmed = input.trim();
  const withScheme = /^[a-z]+:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Unsupported URL scheme");
  }

  url.hash = "";

  for (const param of TRACKING_PARAMS) {
    url.searchParams.delete(param);
  }

  const pathname = url.pathname || "/";
  const canonicalPathname = pathname !== "/" && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;

  return {
    inputUrl: input,
    normalizedUrl: url.toString(),
    effectiveHostname: url.hostname,
    scheme: url.protocol === "https:" ? "https" : "http",
    canonicalKey: `${url.protocol}//${url.hostname}${canonicalPathname || "/"}`
  };
}

export async function resolveSafeAddresses(hostname: string) {
  if (isBlockedHostname(hostname)) {
    throw new Error("Blocked hostname");
  }

  if (net.isIP(hostname)) {
    if (
      (net.isIPv4(hostname) && isPrivateIpv4(hostname)) ||
      (net.isIPv6(hostname) && isBlockedIpv6(hostname))
    ) {
      throw new Error("Blocked IP target");
    }

    return [hostname];
  }

  const resolved = await dns.lookup(hostname, {
    all: true,
    verbatim: true
  });

  if (!resolved.length) {
    throw new Error("Could not resolve hostname");
  }

  for (const entry of resolved) {
    if (
      (entry.family === 4 && isPrivateIpv4(entry.address)) ||
      (entry.family === 6 && isBlockedIpv6(entry.address))
    ) {
      throw new Error("Resolved address is blocked");
    }
  }

  return resolved.map((entry) => entry.address);
}

export async function ensureSafeTarget(input: string) {
  const normalized = normalizeUrl(input);
  await resolveSafeAddresses(normalized.effectiveHostname);
  return normalized;
}
