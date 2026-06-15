import { SubscriptionPlan } from "@/lib/subscription/plan-types";

/** Key used when super admin persists pricing to the platform settings store. */
export const SUBSCRIPTION_PRICING_SETTING_KEY = "subscription_pricing";

export type PlanPricingEntry = {
  priceMonthly: number;
  currency: string;
  /** When set, shown instead of formatted priceMonthly (e.g. "Custom", "Contact us"). */
  priceLabel?: string;
};

export type PlanPricingConfig = Record<SubscriptionPlan, PlanPricingEntry>;

export const DEFAULT_PLAN_PRICING: PlanPricingConfig = {
  [SubscriptionPlan.STARTER]: {
    priceMonthly: 179,
    currency: "AED",
  },
  [SubscriptionPlan.PROFESSIONAL]: {
    priceMonthly: 549,
    currency: "AED",
  },
  [SubscriptionPlan.ENTERPRISE]: {
    priceMonthly: 0,
    currency: "AED",
    priceLabel: "Custom",
  },
};

function parseEnvPrice(value: string | undefined): number | undefined {
  if (!value?.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

function applyEnvOverrides(config: PlanPricingConfig): PlanPricingConfig {
  const currency = process.env.SUBSCRIPTION_CURRENCY?.trim() || undefined;
  const starter = parseEnvPrice(process.env.SUBSCRIPTION_PRICE_STARTER_MONTHLY);
  const professional = parseEnvPrice(process.env.SUBSCRIPTION_PRICE_PROFESSIONAL_MONTHLY);

  return {
    [SubscriptionPlan.STARTER]: {
      ...config[SubscriptionPlan.STARTER],
      ...(currency ? { currency } : {}),
      ...(starter !== undefined ? { priceMonthly: starter } : {}),
    },
    [SubscriptionPlan.PROFESSIONAL]: {
      ...config[SubscriptionPlan.PROFESSIONAL],
      ...(currency ? { currency } : {}),
      ...(professional !== undefined ? { priceMonthly: professional } : {}),
    },
    [SubscriptionPlan.ENTERPRISE]: {
      ...config[SubscriptionPlan.ENTERPRISE],
      ...(currency ? { currency } : {}),
    },
  };
}

export function formatPlanPriceLabel(entry: PlanPricingEntry): string {
  if (entry.priceLabel) return entry.priceLabel;
  return `${entry.currency} ${entry.priceMonthly.toLocaleString("en-US")}`;
}

/**
 * Resolves public subscription pricing.
 * Today: defaults with optional env overrides.
 * Later: super admin can persist overrides (e.g. PlatformSetting JSON) and merge here.
 */
export async function getPlanPricingConfig(): Promise<PlanPricingConfig> {
  // Future: load from DB — e.g. db.platformSetting.findUnique({ where: { key: SUBSCRIPTION_PRICING_SETTING_KEY } })
  return applyEnvOverrides(DEFAULT_PLAN_PRICING);
}
