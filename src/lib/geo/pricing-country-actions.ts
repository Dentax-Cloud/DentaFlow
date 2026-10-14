"use server";

import { cookies } from "next/headers";
import { isSupportedPricingCountry } from "@/lib/geo/detect-country";
import { PRICING_COUNTRY_OVERRIDE_COOKIE } from "@/lib/geo/pricing-country-constants";

/**
 * Persists a visitor's explicit choice to see pricing in a different country/currency than
 * the one auto-detected from their IP. Deliberately a separate, longer-lived cookie from the
 * detection itself (which isn't cookie-backed at all — it's recomputed per request) so an
 * explicit override always wins and survives even if the visitor's IP/location changes later.
 */
export async function setPricingCountryOverride(countryCode: string): Promise<void> {
  if (!isSupportedPricingCountry(countryCode)) return;
  const store = await cookies();
  store.set(PRICING_COUNTRY_OVERRIDE_COOKIE, countryCode.toUpperCase(), {
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // 180 days
    sameSite: "lax",
  });
}

export async function clearPricingCountryOverride(): Promise<void> {
  const store = await cookies();
  store.delete(PRICING_COUNTRY_OVERRIDE_COOKIE);
}
