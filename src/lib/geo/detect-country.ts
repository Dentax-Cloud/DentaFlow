import { headers } from "next/headers";
import geoip from "geoip-lite";
import { COUNTRY_PROFILES } from "@/lib/countries";
import { DEFAULT_PRICING_COUNTRY } from "@/lib/subscription/plan-pricing";

const SUPPORTED_CODES = new Set(Object.keys(COUNTRY_PROFILES));

export function isSupportedPricingCountry(code: string): boolean {
  return SUPPORTED_CODES.has(code.toUpperCase());
}

/**
 * Best-effort client IP from the request, as forwarded by the nginx reverse proxy that sits
 * in front of this app in production (see docker-compose.prod.yml — nginx terminates TLS and
 * proxies to this container over plain HTTP on localhost). Takes the left-most address in a
 * comma-separated X-Forwarded-For list (the original client, assuming nginx appends rather
 * than overwrites), falling back to X-Real-IP. Returns null for local/dev requests, or if the
 * reverse proxy isn't configured to forward either header.
 */
function getClientIp(headerList: Headers): string | null {
  const xff = headerList.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const xRealIp = headerList.get("x-real-ip");
  if (xRealIp?.trim()) return xRealIp.trim();
  return null;
}

/**
 * Detects the visitor's country from their IP address, for the sole purpose of picking which
 * currency to show on the public pricing page — not used for anything legal/compliance-sensitive,
 * and never blocks or changes behavior beyond that one display choice. Uses a self-hosted,
 * offline IP-to-country database (geoip-lite) rather than a third-party API: no per-request
 * network call, no external cost/rate limit, and visitor IPs never leave this server.
 *
 * Falls back to DEFAULT_PRICING_COUNTRY whenever the IP is missing/private (dev, or the reverse
 * proxy not forwarding the header), the lookup fails, or it resolves to a country this app has
 * no country/currency profile for (`src/lib/countries`).
 */
export async function detectVisitorCountry(): Promise<string> {
  try {
    const headerList = await headers();
    const ip = getClientIp(headerList);
    if (!ip) return DEFAULT_PRICING_COUNTRY;

    const geo = geoip.lookup(ip);
    const code = geo?.country?.toUpperCase();
    if (code && SUPPORTED_CODES.has(code)) return code;
    return DEFAULT_PRICING_COUNTRY;
  } catch {
    return DEFAULT_PRICING_COUNTRY;
  }
}
