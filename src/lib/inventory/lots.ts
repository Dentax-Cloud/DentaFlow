/**
 * FEFO lot helpers + near-expiry window shared with inventory expiry alerts.
 * `getExpiryAlerts(daysAhead = 30)` is the source of truth for the window.
 */

/** Same default as `getExpiryAlerts` — do not invent a separate threshold. */
export const NEAR_EXPIRY_DAYS = 30;

export type InventoryLotSuggestion = {
  batchId: string;
  lotNumber: string;
  expiryDate: string | null;
  currentQty: number;
  /** Days until expiry (negative if already expired). Null if no expiry date. */
  daysUntilExpiry: number | null;
  isExpired: boolean;
  isNearExpiry: boolean;
};

export type LotExpiryWarning = {
  level: "expired" | "near_expiry";
  message: string;
};

export function daysUntilExpiry(
  expiryDate: Date | string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (expiryDate == null || expiryDate === "") return null;
  const exp = expiryDate instanceof Date ? expiryDate : new Date(expiryDate);
  if (Number.isNaN(exp.getTime())) return null;
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfExp = new Date(exp.getFullYear(), exp.getMonth(), exp.getDate());
  return Math.round(
    (startOfExp.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000),
  );
}

export function lotExpiryWarning(
  expiryDate: Date | string | null | undefined,
  opts?: { nearExpiryDays?: number; now?: Date },
): LotExpiryWarning | null {
  const nearDays = opts?.nearExpiryDays ?? NEAR_EXPIRY_DAYS;
  const days = daysUntilExpiry(expiryDate, opts?.now);
  if (days == null) return null;
  if (days < 0) {
    return {
      level: "expired",
      message: `This lot expired ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} ago.`,
    };
  }
  if (days <= nearDays) {
    return {
      level: "near_expiry",
      message:
        days === 0
          ? "This lot expires today."
          : `This lot expires in ${days} day${days === 1 ? "" : "s"} (within the ${nearDays}-day near-expiry window).`,
    };
  }
  return null;
}

/**
 * Sort batches FEFO: soonest expiry first; null expiry last; then higher qty.
 * Pure — used by DB query ordering tests and UI.
 */
export function sortLotsFefo<T extends { expiryDate: Date | string | null; currentQty: number }>(
  lots: T[],
  now: Date = new Date(),
): T[] {
  return [...lots].sort((a, b) => {
    const da = daysUntilExpiry(a.expiryDate, now);
    const db = daysUntilExpiry(b.expiryDate, now);
    if (da == null && db == null) return b.currentQty - a.currentQty;
    if (da == null) return 1;
    if (db == null) return -1;
    if (da !== db) return da - db;
    return b.currentQty - a.currentQty;
  });
}

export function toLotSuggestion(
  batch: {
    id: string;
    lotNumber: string | null;
    expiryDate: Date | string | null;
    currentQty: number;
  },
  now: Date = new Date(),
): InventoryLotSuggestion | null {
  const lot = batch.lotNumber?.trim();
  if (!lot) return null;
  const days = daysUntilExpiry(batch.expiryDate, now);
  const warning = lotExpiryWarning(batch.expiryDate, { now });
  return {
    batchId: batch.id,
    lotNumber: lot,
    expiryDate:
      batch.expiryDate == null
        ? null
        : batch.expiryDate instanceof Date
          ? batch.expiryDate.toISOString()
          : new Date(batch.expiryDate).toISOString(),
    currentQty: batch.currentQty,
    daysUntilExpiry: days,
    isExpired: warning?.level === "expired",
    isNearExpiry: warning?.level === "near_expiry",
  };
}

export type MaterialTier = "tracked" | "consumable";

export function normalizeItemDefaultTier(value: string | null | undefined): MaterialTier {
  return value === "tracked" ? "tracked" : "consumable";
}
