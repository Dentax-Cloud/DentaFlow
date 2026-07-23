import { db } from "@/lib/db";

/**
 * Thrown when a legacy (non-spine) invoice path tries to bill a patient who still
 * has an open, unbilled Module 6 Encounter. Prevents parallel invoices that bypass
 * spine gates and the Invoice.encounterId double-invoice guard.
 */
export class OpenSpineEncounterBlocksLegacyInvoiceError extends Error {
  readonly appointmentId: string;
  readonly encounterId: string;

  constructor(params: { appointmentId: string; encounterId: string; message?: string }) {
    super(
      params.message ??
        "An active encounter visit is in progress for this patient. Use Close & invoice on the encounter spine — do not generate a separate invoice from the classic clinical page.",
    );
    this.name = "OpenSpineEncounterBlocksLegacyInvoiceError";
    this.appointmentId = params.appointmentId;
    this.encounterId = params.encounterId;
  }
}

/**
 * Find an open (not closed, not soft-deleted) Encounter that has not yet been
 * billed via spine Close & invoice.
 */
export async function findOpenUnbilledEncounterForPatient(
  tenantId: string,
  patientId: string,
): Promise<{ id: string; appointmentId: string; status: string } | null> {
  return db.encounter.findFirst({
    where: {
      tenantId,
      patientId,
      deletedAt: null,
      closedAt: null,
      billedInvoice: { is: null },
    },
    select: { id: true, appointmentId: true, status: true },
    orderBy: { startedAt: "desc" },
  });
}

/**
 * Block legacy invoice creation while a spine Encounter is still open/unbilled.
 * Skip when the caller is the spine path itself (`encounterId` set).
 */
export async function assertNoOpenEncounterBlocksLegacyInvoice(params: {
  tenantId: string;
  patientId: string;
  /** When set, this create is the spine Close & invoice path — do not block. */
  encounterId?: string | null;
}): Promise<void> {
  if (params.encounterId) return;

  const open = await findOpenUnbilledEncounterForPatient(
    params.tenantId,
    params.patientId,
  );
  if (!open) return;

  throw new OpenSpineEncounterBlocksLegacyInvoiceError({
    appointmentId: open.appointmentId,
    encounterId: open.id,
  });
}
