import type { InvoiceLineItem } from "@/lib/billing/invoice-from-items";
import type { InvoiceItemType } from "@/lib/billing/india-gst";

export type ProcedureLineBillable = {
  id: string;
  ownerType: string;
  ownerId: string | null;
  ownerName?: string | null;
  status: string;
  procedureCode: string | null;
  procedureName: string | null;
  unitPrice: number;
  quantity: number;
  lockedAt?: Date | string | null;
  lockedInvoiceId?: string | null;
  /** Optional GST metadata for STORE / retail lines */
  itemType?: InvoiceItemType | null;
  gstRatePercent?: number | null;
  hsnCode?: string | null;
  inventoryItemId?: string | null;
};

export type AgingBucket = "0-24h" | "1-3d" | "3d+";

export type BillingQueueSection = "ready" | "interim";

export function assertProcedureLineModifiable(line: {
  status: string;
  lockedAt?: Date | string | null;
}): void {
  if (line.status === "LOCKED" || line.lockedAt) {
    throw new Error("This procedure line is locked after billing and cannot be modified.");
  }
}

export function mapProcedureLineToInvoiceItem(line: ProcedureLineBillable): InvoiceLineItem {
  const unitPrice = line.unitPrice;
  const quantity = line.quantity;
  const description =
    line.procedureName ??
    line.procedureCode ??
    (line.ownerType === "STORE" ? "Store item" : "Procedure");
  const total = unitPrice * quantity;

  if (line.ownerType === "STORE") {
    return {
      description,
      quantity,
      unitPrice,
      total,
      procedureCode: line.procedureCode,
      inventoryItemId: line.inventoryItemId ?? null,
      itemType: line.itemType ?? "GOOD",
      gstRatePercent: line.gstRatePercent ?? null,
      hsnCode: line.hsnCode ?? null,
    };
  }

  return {
    description,
    quantity,
    unitPrice,
    total,
    procedureCode: line.procedureCode,
    itemType: line.itemType ?? "SERVICE",
  };
}

export function mapProcedureLinesToInvoiceItems(lines: ProcedureLineBillable[]): InvoiceLineItem[] {
  return lines.map(mapProcedureLineToInvoiceItem);
}

export function aggregateProcedureLineTotal(lines: ProcedureLineBillable[]): number {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

export function selectBillableProcedureLines(
  lines: ProcedureLineBillable[],
  linesOnly?: string[],
): ProcedureLineBillable[] {
  let candidates = lines.filter(
    (line) =>
      line.status === "CLOSED" &&
      !line.lockedAt &&
      !line.lockedInvoiceId,
  );

  if (linesOnly?.length) {
    const allowed = new Set(linesOnly);
    candidates = candidates.filter((line) => allowed.has(line.id));
  }

  return candidates;
}

export function classifyAppointmentForBillingQueue(
  appointmentStatus: string,
  lines: Pick<ProcedureLineBillable, "status" | "lockedAt" | "lockedInvoiceId">[],
): { section: BillingQueueSection | null; hasUnbilledClosed: boolean } {
  const unbilledClosed = lines.filter(
    (line) =>
      line.status === "CLOSED" && !line.lockedAt && !line.lockedInvoiceId,
  );
  const hasUnbilledClosed = unbilledClosed.length > 0;
  if (!hasUnbilledClosed) {
    return { section: null, hasUnbilledClosed: false };
  }

  const hasInProgress = lines.some((line) => line.status === "IN_PROGRESS");

  if (appointmentStatus === "COMPLETED") {
    return { section: "ready", hasUnbilledClosed: true };
  }

  if (hasInProgress && hasUnbilledClosed) {
    return { section: "interim", hasUnbilledClosed: true };
  }

  return { section: null, hasUnbilledClosed: false };
}

export function getAgingBucket(completedAt: Date, now: Date = new Date()): AgingBucket {
  const hours = (now.getTime() - completedAt.getTime()) / (1000 * 60 * 60);
  if (hours <= 24) return "0-24h";
  if (hours <= 72) return "1-3d";
  return "3d+";
}

export function countDistinctVisitInvoices(
  lockedInvoiceIds: Array<string | null | undefined>,
): number {
  return new Set(lockedInvoiceIds.filter((id): id is string => Boolean(id))).size;
}

export function buildVisitInvoiceNotes(params: {
  appointmentId: string;
  appointmentRef?: string | null;
  visitInvoiceNumber: number;
  isInterim: boolean;
}): string {
  const ref = params.appointmentRef?.trim() || params.appointmentId;
  const label = `Invoice ${params.visitInvoiceNumber} of visit ${ref}`;
  return params.isInterim ? `${label} (interim — visit still in progress)` : label;
}

export function extractProcedureCodesFromInvoiceItems(
  items: Pick<InvoiceLineItem, "procedureCode">[],
): string[] {
  return items.map((item) => item.procedureCode).filter((code): code is string => Boolean(code));
}
