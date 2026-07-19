import { isProcedureLineBillable } from "./state-machine";

/** Pure selection rules for which spine lines enter an invoice. */
export function isSpineLineIncludedInInvoice(
  line: { status: string; billedInvoiceId?: string | null },
  opts?: { partialBill?: boolean },
): boolean {
  if (line.billedInvoiceId) return false;
  if (line.status === "declined") return false;
  if (line.status === "in_progress" || line.status === "planned") return false;
  if (!isProcedureLineBillable(line.status)) return false;
  if (line.status === "interrupted" && !opts?.partialBill) return false;
  return true;
}

/**
 * Pure pre-flight for Close & Invoice. Returns a validation message, never throws.
 * `in_progress` / `planned` are not billable — only `completed` (or `interrupted` + partialBill).
 */
export function getEncounterInvoiceGateMessage(
  lines: { status: string; billedInvoiceId?: string | null }[],
  opts?: { partialBill?: boolean },
): string | null {
  if (lines.some((l) => l.status === "in_progress")) {
    return "Cannot generate invoice while any procedure line is still in progress.";
  }
  if (!lines.some((l) => isSpineLineIncludedInInvoice(l, opts))) {
    return "No billable procedure or material lines to invoice. Complete at least one procedure line before closing.";
  }
  return null;
}
