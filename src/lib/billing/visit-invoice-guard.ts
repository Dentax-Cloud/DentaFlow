import { db } from "@/lib/db";

/** Visit-linked invoice kinds. INTERIM allows multiple sequences; FINAL/CHAIRSIDE are non-interim. */
export type VisitBillingKind = "INTERIM" | "FINAL" | "CHAIRSIDE";

export class VisitInvoiceConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VisitInvoiceConflictError";
  }
}

/**
 * Guard dual invoice paths (chairside finalize vs ProcedureLine Ready-to-Invoice).
 * - Paths are mutually exclusive per appointment once either has created an invoice.
 * - Multiple INTERIM invoices (Phase 4 partial billing) remain allowed via visitSequence.
 * - FINAL / CHAIRSIDE are non-interim: at most one non-interim primary close-out.
 */
export async function assertCanCreateVisitInvoice(params: {
  tenantId: string;
  appointmentId: string;
  billingKind: VisitBillingKind;
}): Promise<{ nextVisitSequence: number }> {
  const existing = await db.invoice.findMany({
    where: {
      tenantId: params.tenantId,
      appointmentId: params.appointmentId,
      deletedAt: null,
    },
    select: { id: true, billingKind: true, visitSequence: true },
    orderBy: { visitSequence: "asc" },
  });

  const hasChairside = existing.some((i) => i.billingKind === "CHAIRSIDE");
  const hasLineInvoice = existing.some(
    (i) => i.billingKind === "INTERIM" || i.billingKind === "FINAL",
  );
  const hasFinal = existing.some((i) => i.billingKind === "FINAL");

  if (params.billingKind === "CHAIRSIDE") {
    if (existing.length > 0) {
      throw new VisitInvoiceConflictError(
        "This appointment already has a visit invoice. " +
          "Chairside finalize cannot create a second invoice for the same visit. " +
          "Use Ready-to-Invoice for ProcedureLine billing only when no chairside invoice exists.",
      );
    }
  } else {
    // ProcedureLine path (INTERIM or FINAL)
    if (hasChairside) {
      throw new VisitInvoiceConflictError(
        "This appointment was already invoiced via chairside finalize. " +
          "Cannot create a ProcedureLine / Ready-to-Invoice invoice for the same visit.",
      );
    }
    if (hasFinal) {
      throw new VisitInvoiceConflictError(
        "A final invoice already exists for this appointment. " +
          "Additional interim or final invoices are blocked.",
      );
    }
  }

  const nextVisitSequence =
    existing.reduce((max, i) => Math.max(max, i.visitSequence ?? 0), 0) + 1;

  return { nextVisitSequence };
}

/** True when any visit-linked invoice already exists for the appointment. */
export async function appointmentHasVisitInvoice(
  tenantId: string,
  appointmentId: string,
): Promise<boolean> {
  const row = await db.invoice.findFirst({
    where: {
      tenantId,
      appointmentId,
      deletedAt: null,
    },
    select: { id: true },
  });
  return Boolean(row);
}
