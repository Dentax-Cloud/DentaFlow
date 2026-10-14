"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { SUPPORTED_COUNTRIES } from "@/lib/countries";
import {
  DEFAULT_PRICING_COUNTRY,
  PLAN_PRICING_BY_COUNTRY,
  getPricingOverrides,
  savePricingOverrides,
} from "@/lib/subscription/plan-pricing";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";

export type PricingTableRow = {
  code: string;
  name: string;
  flag: string;
  currency: string;
  starterMonthly: number;
  professionalMonthly: number;
  /** true when a super admin has set a real price for this country. */
  isOverridden: boolean;
  /** true when this row is still showing the static AE-copy placeholder, not a real price. */
  isPlaceholder: boolean;
};

/**
 * One row per country this app has a currency profile for, merging the super admin's saved
 * overrides (if any) on top of the static placeholder table — exactly the same precedence
 * `getPlanPricingConfig` uses for the public pricing page, so this table always shows what a
 * visitor from that country would actually see right now.
 */
export async function getPricingTableData(): Promise<PricingTableRow[]> {
  await requireSuperAdmin();
  const overrides = await getPricingOverrides();

  return SUPPORTED_COUNTRIES.map((country) => {
    const code = country.code.toUpperCase();
    const base =
      PLAN_PRICING_BY_COUNTRY[code] ?? PLAN_PRICING_BY_COUNTRY[DEFAULT_PRICING_COUNTRY];
    const override = overrides[code];

    return {
      code,
      name: country.name,
      flag: country.flag,
      currency: country.currency,
      starterMonthly: override?.starterMonthly ?? base[SubscriptionPlan.STARTER].priceMonthly,
      professionalMonthly:
        override?.professionalMonthly ?? base[SubscriptionPlan.PROFESSIONAL].priceMonthly,
      isOverridden: Boolean(override),
      isPlaceholder: !override && code !== DEFAULT_PRICING_COUNTRY,
    };
  });
}

/**
 * Sets (or replaces) one country's real Starter/Professional monthly price. Enterprise is
 * intentionally not editable here — it always stays "Custom" / contact sales.
 */
export async function savePricingRow(
  countryCode: string,
  starterMonthly: number,
  professionalMonthly: number,
): Promise<void> {
  const userId = await requireSuperAdmin();

  if (!Number.isFinite(starterMonthly) || starterMonthly < 0) {
    throw new Error("Starter price must be a non-negative number");
  }
  if (!Number.isFinite(professionalMonthly) || professionalMonthly < 0) {
    throw new Error("Professional price must be a non-negative number");
  }

  const code = countryCode.toUpperCase();
  const overrides = await getPricingOverrides();
  overrides[code] = { starterMonthly, professionalMonthly };
  await savePricingOverrides(overrides, userId);

  console.info("[PlatformSettings] pricing override saved", { code, userId });
  revalidatePath("/superadmin/settings");
  revalidatePath("/");
}

/** Reverts one country back to the static placeholder (or the AE baseline for AE itself). */
export async function clearPricingRow(countryCode: string): Promise<void> {
  const userId = await requireSuperAdmin();
  const code = countryCode.toUpperCase();

  const overrides = await getPricingOverrides();
  delete overrides[code];
  await savePricingOverrides(overrides, userId);

  console.info("[PlatformSettings] pricing override cleared", { code, userId });
  revalidatePath("/superadmin/settings");
  revalidatePath("/");
}
