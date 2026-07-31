/** Reason taxonomy for StockTransaction ADJUSTMENT writes. */
export const STOCK_ADJUSTMENT_REASONS = [
  "breakage",
  "wastage",
  "count-correction",
  "found-stock",
] as const;

export type StockAdjustmentReason = (typeof STOCK_ADJUSTMENT_REASONS)[number];
