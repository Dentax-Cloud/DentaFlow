/**
 * Reason taxonomy for formal Store "Issue stock" writes (USAGE + audit).
 * Reuses breakage/wastage from the ADJUSTMENT taxonomy and adds allocation contexts.
 */
export const STOCK_ISSUE_REASONS = [
  "breakage",
  "wastage",
  "allocated-to-chair",
  "allocated-to-staff",
  "other",
] as const;

export type StockIssueReason = (typeof STOCK_ISSUE_REASONS)[number];

export const STOCK_ISSUE_DESTINATION_TYPES = ["chair", "staff", "other"] as const;

export type StockIssueDestinationType = (typeof STOCK_ISSUE_DESTINATION_TYPES)[number];
