import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { formatCurrency, getCurrency } from "@/lib/countries";
import { db } from "@/lib/db";
import { getFxRates, type FxRatesSnapshot } from "@/lib/subscription/fx-rates";

/** Key used when super admin persists pricing to the platform settings store. */
export const SUBSCRIPTION_PRICING_SETTING_KEY = "subscription_pricing";

export type PlanPricingEntry = {
  priceMonthly: number;
  /** When set, shown instead of the formatted priceMonthly (e.g. "Custom", "Contact us"). */
  priceLabel?: string;
};

export type CountryPlanPricing = Record<SubscriptionPlan, PlanPricingEntry>;

/** Country/currency this app falls back to when a visitor's country has no pricing row below. */
export const DEFAULT_PRICING_COUNTRY = "AE";

/**
 * One super-admin-editable override row per country: Starter/Professional monthly price in
 * that country's own currency. Enterprise is deliberately never overridable here — it always
 * stays "Custom" / contact sales, in the static table below and in the UI.
 */
export type PricingOverrideRow = {
  starterMonthly: number;
  professionalMonthly: number;
};

export type PricingOverrides = Record<string, PricingOverrideRow>;

/**
 * Static fallback table — one row per country this app has a country profile for. This used to
 * be the primary source for every non-AE country's price (all copied from AE as a placeholder).
 * It is now ONLY a fallback, used when live FX conversion is unavailable (the rate API is down
 * and there's no cached snapshot yet — see fx-rates.ts). In normal operation, a non-AE country
 * with no super-admin override gets its price computed live from the AE baseline via
 * `computeCountryPricing` below, not from this table.
 *
 * AE itself is the real baseline (AED 179 / 549, unchanged). The super admin's "Pricing" tab
 * (`/superadmin/settings` → Pricing) can still set an explicit override for any country,
 * including AE — an override always wins over both FX conversion and this fallback table.
 */
export const PLAN_PRICING_BY_COUNTRY: Record<string, CountryPlanPricing> = {
  AE: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  SA: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  QA: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  BH: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  KW: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  OM: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  GB: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  US: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  IN: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  SG: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  AU: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
};

function parseEnvPrice(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

/**
 * Legacy env-var price override, kept for backward compatibility with however
 * `.env.production` is configured today. Scoped to DEFAULT_PRICING_COUNTRY only (AE) — before
 * this file supported multiple countries there was only ever one price/currency to override,
 * so applying these vars to every country now would silently change prices nobody asked to
 * change. If `.env.production` sets SUBSCRIPTION_PRICE_STARTER_MONTHLY /
 * SUBSCRIPTION_PRICE_PROFESSIONAL_MONTHLY, double-check they still mean what they meant before.
 * This is the highest-precedence override for AE's baseline price — above the super-admin DB
 * override, since AE is also where every other country's auto-converted price derives from.
 */
function applyEnvOverrides(config: CountryPlanPricing): CountryPlanPricing {
  const starter = parseEnvPrice(process.env.SUBSCRIPTION_PRICE_STARTER_MONTHLY);
  const professional = parseEnvPrice(process.env.SUBSCRIPTION_PRICE_PROFESSIONAL_MONTHLY);

  return {
    [SubscriptionPlan.STARTER]: {
      ...config[SubscriptionPlan.STARTER],
      ...(starter !== undefined ? { priceMonthly: starter } : {}),
    },
    [SubscriptionPlan.PROFESSIONAL]: {
      ...config[SubscriptionPlan.PROFESSIONAL],
      ...(professional !== undefined ? { priceMonthly: professional } : {}),
    },
    [SubscriptionPlan.ENTERPRISE]: config[SubscriptionPlan.ENTERPRISE],
  };
}

/**
 * Reads the super admin's per-country price overrides from the platform settings store (one
 * JSON blob under `SUBSCRIPTION_PRICING_SETTING_KEY`, same table/pattern as every other platform
 * setting — see `src/lib/settings/platform-settings.ts`). Returns `{}` on any read/parse failure
 * (including the DB being unreachable, e.g. during a build with no local DB running) so a
 * missing or malformed override blob degrades to the static placeholder table rather than
 * breaking the public pricing page.
 */
export async function getPricingOverrides(): Promise<PricingOverrides> {
  try {
    const record = await db.platformSetting.findUnique({
      where: { key: SUBSCRIPTION_PRICING_SETTING_KEY },
      select: { value: true },
    });
    if (!record?.value) return {};

    const parsed = JSON.parse(record.value) as unknown;
    if (!parsed || typeof parsed !== "object") return {};

    const overrides: PricingOverrides = {};
    for (const [code, row] of Object.entries(parsed as Record<string, unknown>)) {
      if (!row || typeof row !== "object") continue;
      const starterMonthly = Number((row as PricingOverrideRow).starterMonthly);
      const professionalMonthly = Number((row as PricingOverrideRow).professionalMonthly);
      if (!Number.isFinite(starterMonthly) || !Number.isFinite(professionalMonthly)) continue;
      if (starterMonthly < 0 || professionalMonthly < 0) continue;
      overrides[code.toUpperCase()] = { starterMonthly, professionalMonthly };
    }
    return overrides;
  } catch (err) {
    console.warn("[PlanPricing] Failed to read pricing overrides, using static table", err);
    return {};
  }
}

/**
 * Persists the full set of super-admin price overrides as one JSON blob. Called with the
 * complete map each time (read-modify-write from the superadmin Pricing tab's server actions)
 * rather than a per-field patch, since this is one row per country, not one setting per key.
 */
export async function savePricingOverrides(
  overrides: PricingOverrides,
  updatedById?: string,
): Promise<void> {
  await db.platformSetting.upsert({
    where: { key: SUBSCRIPTION_PRICING_SETTING_KEY },
    create: {
      key: SUBSCRIPTION_PRICING_SETTING_KEY,
      value: JSON.stringify(overrides),
      encrypted: false,
      category: "SUBSCRIPTION",
      description: "Per-country Starter/Professional monthly pricing overrides",
      updatedById: updatedById ?? null,
    },
    update: {
      value: JSON.stringify(overrides),
      updatedById: updatedById ?? null,
      updatedAt: new Date(),
    },
  });
}

/**
 * Pure pricing calculation for one country, given already-fetched overrides and FX snapshot.
 * Precedence, highest first:
 *   1. AE's legacy env-var override (back-compat) — folded into the "AE baseline" below.
 *   2. An explicit super-admin DB override for this exact country (wins over auto-conversion).
 *   3. For AE itself: the baseline (static 179/549, plus any of the above).
 *   4. For any other country: auto-converted from the AE baseline using the live AED->currency
 *      FX rate, rounded to a whole number in that currency.
 *   5. If FX conversion isn't possible (no rate / rates unavailable): the static fallback table.
 * Enterprise is never overridden or converted — always "Custom" / contact sales, taken from the
 * AE baseline's Enterprise entry (so a label change there would propagate, though none exists).
 */
function computeCountryPricing(
  code: string,
  overrides: PricingOverrides,
  fx: FxRatesSnapshot | null,
): CountryPlanPricing {
  const aeStatic = PLAN_PRICING_BY_COUNTRY[DEFAULT_PRICING_COUNTRY];
  const aeOverride = overrides[DEFAULT_PRICING_COUNTRY];
  const aeBaseline = applyEnvOverrides({
    [SubscriptionPlan.STARTER]: {
      ...aeStatic[SubscriptionPlan.STARTER],
      ...(aeOverride ? { priceMonthly: aeOverride.starterMonthly } : {}),
    },
    [SubscriptionPlan.PROFESSIONAL]: {
      ...aeStatic[SubscriptionPlan.PROFESSIONAL],
      ...(aeOverride ? { priceMonthly: aeOverride.professionalMonthly } : {}),
    },
    [SubscriptionPlan.ENTERPRISE]: aeStatic[SubscriptionPlan.ENTERPRISE],
  });

  if (code === DEFAULT_PRICING_COUNTRY) return aeBaseline;

  const override = overrides[code];
  if (override) {
    const base = PLAN_PRICING_BY_COUNTRY[code] ?? aeStatic;
    return {
      [SubscriptionPlan.STARTER]: {
        ...base[SubscriptionPlan.STARTER],
        priceMonthly: override.starterMonthly,
      },
      [SubscriptionPlan.PROFESSIONAL]: {
        ...base[SubscriptionPlan.PROFESSIONAL],
        priceMonthly: override.professionalMonthly,
      },
      [SubscriptionPlan.ENTERPRISE]: aeBaseline[SubscriptionPlan.ENTERPRISE],
    };
  }

  const currency = getCurrency(code);
  const rate = fx?.rates?.[currency];
  if (rate && Number.isFinite(rate) && rate > 0) {
    return {
      [SubscriptionPlan.STARTER]: {
        priceMonthly: Math.round(aeBaseline[SubscriptionPlan.STARTER].priceMonthly * rate),
      },
      [SubscriptionPlan.PROFESSIONAL]: {
        priceMonthly: Math.round(aeBaseline[SubscriptionPlan.PROFESSIONAL].priceMonthly * rate),
      },
      [SubscriptionPlan.ENTERPRISE]: aeBaseline[SubscriptionPlan.ENTERPRISE],
    };
  }

  // FX unavailable (API unreachable and no cached snapshot yet) — fall back to the static table
  // rather than showing nothing.
  const fallback = PLAN_PRICING_BY_COUNTRY[code] ?? aeStatic;
  return {
    [SubscriptionPlan.STARTER]: fallback[SubscriptionPlan.STARTER],
    [SubscriptionPlan.PROFESSIONAL]: fallback[SubscriptionPlan.PROFESSIONAL],
    [SubscriptionPlan.ENTERPRISE]: aeBaseline[SubscriptionPlan.ENTERPRISE],
  };
}

/**
 * Resolves public subscription pricing for one country (defaults to DEFAULT_PRICING_COUNTRY
 * when omitted, matching this function's pre-existing single-currency behavior exactly).
 * Skips the FX fetch entirely when resolving AE itself, since AE never needs conversion — keeps
 * the in-app billing page (which always prices in AE) from ever making an outbound FX call.
 */
export async function getPlanPricingConfig(countryCode?: string): Promise<CountryPlanPricing> {
  const code = (countryCode ?? DEFAULT_PRICING_COUNTRY).toUpperCase();
  const overrides = await getPricingOverrides();
  const fx = code === DEFAULT_PRICING_COUNTRY ? null : await getFxRates();
  return computeCountryPricing(code, overrides, fx);
}

/**
 * Computes pricing for every country this app has a profile for in one pass (one overrides
 * read, one FX snapshot fetch, reused across all countries) — used by the superadmin Pricing
 * tab so it doesn't do a DB/API round-trip per row.
 */
export async function getFullPricingTable(): Promise<{
  pricing: Record<string, CountryPlanPricing>;
  overrides: PricingOverrides;
  fx: FxRatesSnapshot | null;
}> {
  const overrides = await getPricingOverrides();
  const fx = await getFxRates();
  const pricing: Record<string, CountryPlanPricing> = {};
  for (const code of Object.keys(PLAN_PRICING_BY_COUNTRY)) {
    pricing[code] = computeCountryPricing(code, overrides, fx);
  }
  return { pricing, overrides, fx };
}

export function formatPlanPriceLabel(entry: PlanPricingEntry, countryCode: string): string {
  if (entry.priceLabel) return entry.priceLabel;
  return formatCurrency(entry.priceMonthly, countryCode);
}
