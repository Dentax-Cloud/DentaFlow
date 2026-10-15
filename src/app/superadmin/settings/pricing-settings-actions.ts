"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { SUPPORTED_COUNTRIES } from "@/lib/countries";
import {
  DEFAULT_PRICING_COUNTRY,
  getFullPricingTable,
  getPricingOverrides,
  savePricingOverrides,
} from "@/lib/subscription/plan-pricing";
import { refreshFxRates } from "@/lib/subscription/fx-rates";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";

export type PricingTableRow = {
  code: string;
  name: string;
  flag: string;
  currency: string;
  starterMonthly: number;
  professionalMonthly: number;
  /** true for AE — the baseline every other country's price is converted from. */
  isBaseline: boolean;
  /** true when a super admin has set a fixed price for this country. */
  isOverridden: boolean;
  /** true when this row's price is live-converted from the AE baseline via FX rate, not fixed. */
  isConverted: boolean;
  /** AED -> this country's currency rate used, when isConverted. Null otherwise. */
  fxRate: number | null;
};

export type PricingTableData = {
  rows: PricingTableRow[];
  /** When the FX rates currently in use were fetched, or null if no snapshot is cached yet. */
  fxUpdatedAt: string | null;
  /** "live" when a real FX snapshot (fresh or stale-but-cached) backs the converted rows. */
  fxSource: "live" | "unavailable";
};

/**
 * One row per country this app has a currency profile for. A country with no super-admin
 * override shows its price live-converted from the AE baseline via FX rate (same calculation
 * `getPlanPricingConfig` uses for the public pricing page), so this table always matches what a
 * visitor from that country would actually see right now.
 */
export async function getPricingTableData(): Promise<PricingTableData> {
  await requireSuperAdmin();
  const { pricing, overrides, fx } = await getFullPricingTable();

  const rows: PricingTableRow[] = SUPPORTED_COUNTRIES.map((country) => {
    const code = country.code.toUpperCase();
    const isBaseline = code === DEFAULT_PRICING_COUNTRY;
    const override = overrides[code];
    const plan = pricing[code];
    const isConverted = !isBaseline && !override;

    return {
      code,
      name: country.name,
      flag: country.flag,
      currency: country.currency,
      starterMonthly: plan[SubscriptionPlan.STARTER].priceMonthly,
      professionalMonthly: plan[SubscriptionPlan.PROFESSIONAL].priceMonthly,
      isBaseline,
      isOverridden: Boolean(override),
      isConverted,
      fxRate: isConverted ? (fx?.rates?.[country.currency] ?? null) : null,
    };
  });

  return {
    rows,
    fxUpdatedAt: fx?.fetchedAt ?? null,
    fxSource: fx ? "live" : "unavailable",
  };
}

/**
 * Sets (or replaces) one country's fixed Starter/Professional monthly price, overriding live FX
 * conversion for that country from now on. Enterprise is intentionally not editable here — it
 * always stays "Custom" / contact sales. Setting AE's own price here changes the baseline that
 * every other non-overridden country converts from.
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

/**
 * Reverts one country back to live FX conversion from the AE baseline (or, for AE itself, back
 * to the static 179/549 baseline).
 */
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

/**
 * Forces a live FX refetch regardless of the normal 12h cache, for when a super admin wants
 * every auto-converted country to reflect the current rate right now rather than waiting.
 */
export async function refreshPricingFxRates(): Promise<void> {
  await requireSuperAdmin();
  const result = await refreshFxRates();
  if (!result) {
    throw new Error("Couldn't reach the exchange rate service — try again shortly.");
  }
  revalidatePath("/superadmin/settings");
  revalidatePath("/");
}
