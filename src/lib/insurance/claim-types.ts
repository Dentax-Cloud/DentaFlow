/** Immutable procedure line captured at claim submission time. */
export type ClaimProcedureSnapshotLine = {
  procedureCode: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
};

export const CLAIM_DENIAL_CATEGORIES = [
  "COVERAGE",
  "AUTHORIZATION",
  "CODING",
  "DOCUMENTATION",
  "OTHER",
] as const;

export type ClaimDenialCategory = (typeof CLAIM_DENIAL_CATEGORIES)[number];

export const CLAIM_KANBAN_COLUMNS = [
  { key: "DRAFT", label: "Draft" },
  { key: "SUBMITTED", label: "Submitted" },
  { key: "IN_REVIEW", label: "In Review" },
  { key: "APPROVED", label: "Approved" },
  { key: "DENIED", label: "Denied" },
  { key: "PAID", label: "Paid" },
] as const;

/** Map claim statuses to Kanban column keys. */
export function claimKanbanColumn(status: string): string {
  switch (status) {
    case "DRAFT":
      return "DRAFT";
    case "SUBMITTED":
      return "SUBMITTED";
    case "IN_REVIEW":
      return "IN_REVIEW";
    case "APPROVED":
    case "PARTIALLY_APPROVED":
      return "APPROVED";
    case "DENIED":
    case "APPEALED":
    case "WRITTEN_OFF":
      return "DENIED";
    case "PAID":
      return "PAID";
    default:
      return "DRAFT";
  }
}

export function parseProcedureSnapshot(value: unknown): ClaimProcedureSnapshotLine[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((row): row is Record<string, unknown> => row !== null && typeof row === "object")
    .map((row) => ({
      procedureCode: typeof row.procedureCode === "string" ? row.procedureCode : null,
      description: String(row.description ?? ""),
      quantity: Number(row.quantity ?? 1),
      unitPrice: Number(row.unitPrice ?? 0),
      total: Number(row.total ?? 0),
    }));
}
