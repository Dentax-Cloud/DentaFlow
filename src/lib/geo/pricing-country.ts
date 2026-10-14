import { cookies } from "next/headers";
import { detectVisitorCountry, isSupportedPricingCountry } from "@/lib/geo/detect-country";
import { PRICING_COUNTRY_OVERRIDE_COOKIE } from "@/lib/geo/pricing-country-constants";

export type ResolvedPricingCountry = {
  code: string;
  /** true when this came from the visitor's own saved choice, not IP detection. */
  isOverride: boolean;
};

/**
 * The country whose pricing/currency a visitor should see right now: their own saved override
 * if they've ever picked one, otherwise whatever IP geolocation detects this request.
 */
export async function resolvePricingCountry(): Promise<ResolvedPricingCountry> {
  const store = await cookies();
  const override = store.get(PRICING_COUNTRY_OVERRIDE_COOKIE)?.value;
  if (override && isSupportedPricingCountry(override)) {
    return { code: override.toUpperCase(), isOverride: true };
  }
  const detected = await detectVisitorCountry();
  return { code: detected, isOverride: false };
}
