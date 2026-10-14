import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { formatCurrency } from "@/lib/countries";
import { db } from "@/lib/db";

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
 * Local monthly price per plan, per country. One row per country this app has a country
 * profile for (`src/lib/countries`) — currency, symbol, decimals, and locale formatting for
 * display all come from that same profile via `formatCurrency`, so a price shown here always
 * matches the same country-aware formatting used everywhere else in the app.
 *
 * IMPORTANT: only AE carries a real, confirmed baseline price (AED 179 / 549 — the pre-existing
 * price, unchanged). Every other row below is a PLACEHOLDER — the same numeric value as AE,
 * just re-labeled under that country's currency — and is NOT a real local price. GCC currencies
 * in particular are not 1:1 with AED (e.g. 1 BHD/KWD/OMR is worth several AED), so copying the
 * number across currencies is deliberately a visible placeholder, not a quiet approximation
 * anyone could mistake for a real one.
 *
 * This static table is the fallback floor. The super admin's "Pricing" tab
 * (`/superadmin/settings` → Pricing) lets a real admin set a real per-country price without any
 * code change — see `getPricingOverrides`/`savePricingOverrides` below — and an override always
 * wins over the placeholder for that country. Replace or override each placeholder row before
 * trusting it for an actual visitor.
 */
export const PLAN_PRICING_BY_COUNTRY: Record<string, CountryPlanPricing> = {
  // Real, confirmed pricing.
  AE: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },

  // TODO — placeholder only, pending confirmed local pricing (see note above).
  SA: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  // TODO — placeholder only, pending confirmed local pricing (see note above).
  QA: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  // TODO — placeholder only, pending confirmed local pricing (see note above).
  BH: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  // TODO — placeholder only, pending confirmed local pricing (see note above).
  KW: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  // TODO — placeholder only, pending confirmed local pricing (see note above).
  OM: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  // TODO — placeholder only, pending confirmed local pricing (see note above).
  GB: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  // TODO — placeholder only, pending confirmed local pricing (see note above).
  US: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  // TODO — placeholder only, pending confirmed local pricing (see note above).
  IN: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  // TODO — placeholder only, pending confirmed local pricing (see note above).
  SG: {
    STARTER: { priceMonthly: 179 },
    PROFESSIONAL: { priceMonthly: 549 },
    ENTERPRISE: { priceMonthly: 0, priceLabel: "Custom" },
  },
  // TODO — placeholder only, pending confirmed local pricing (see note above).
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
 * This is now the highest-precedence override for AE — above both the static table and the
 * super-admin-editable DB override below — purely for backward compatibility with any ops
 * tooling that still sets it; new pricing changes should go through the superadmin Pricing tab
 * instead.
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
 * Resolves public subscription pricing for one country (defaults to DEFAULT_PRICING_COUNTRY
 * when omitted, matching this function's pre-existing single-currency behavior exactly).
 * Precedence, highest first: the legacy AE-only env vars (back-compat), then the super admin's
 * DB override for that country (if any), then the static placeholder table.
 */
export async function getPlanPricingConfig(countryCode?: string): Promise<CountryPlanPricing> {
  const code = (countryCode ?? DEFAULT_PRICING_COUNTRY).toUpperCase();
  const base = PLAN_PRICING_BY_COUNTRY[code] ?? PLAN_PRICING_BY_COUNTRY[DEFAULT_PRICING_COUNTRY];

  const overrides = await getPricingOverrides();
  const override = overrides[code];

  const merged: CountryPlanPricing = {
    [SubscriptionPlan.STARTER]: {
      ...base[SubscriptionPlan.STARTER],
      ...(override ? { priceMonthly: override.starterMonthly } : {}),
    },
    [SubscriptionPlan.PROFESSIONAL]: {
      ...base[SubscriptionPlan.PROFESSIONAL],
      ...(override ? { priceMonthly: override.professionalMonthly } : {}),
    },
    // Enterprise is never overridden — always "Custom" / contact sales.
    [SubscriptionPlan.ENTERPRISE]: base[SubscriptionPlan.ENTERPRISE],
  };

  return code === DEFAULT_PRICING_COUNTRY ? applyEnvOverrides(merged) : merged;
}

export function formatPlanPriceLabel(entry: PlanPricingEntry, countryCode: string): string {
  if (entry.priceLabel) return entry.priceLabel;
  return formatCurrency(entry.priceMonthly, countryCode);
}
