export type ReportDateRange = "week" | "month" | "custom";

/**
 * Shared window for Reports + Dashboard "this month" / MTD cards.
 * `month` is a rolling ~31 days (not calendar month-start) so every
 * revenue-labeled surface uses the same bounds.
 */
export function reportRangeBounds(
  range: ReportDateRange,
  customStart?: Date,
  customEnd?: Date,
) {
  const end = customEnd ?? new Date();
  const start = customStart ?? new Date();
  if (!customStart) {
    if (range === "week") {
      start.setDate(end.getDate() - 7);
    } else {
      start.setMonth(end.getMonth() - 1);
    }
  }
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

/** Invoice.total billed in range. Includes DRAFT/unpaid; excludes VOID. */
export const BILLED_INVOICE_STATUS = { not: "VOID" as const };

export function billedInvoiceParentWhere(start: Date, end: Date) {
  return {
    deletedAt: null,
    createdAt: { gte: start, lte: end },
    status: BILLED_INVOICE_STATUS,
  };
}

export function billedInvoiceWhere(tenantId: string, start: Date, end: Date) {
  return {
    tenantId,
    ...billedInvoiceParentWhere(start, end),
  };
}

export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

/** Same-patient, same-calendar-day fallback used by doctor productivity. */
export function findSameDayPatientInvoice<
  T extends { id: string; patientId: string; createdAt: Date },
>(
  invoices: T[],
  appointment: { patientId: string | null; startTime: Date },
  alreadyAttributed: Set<string>,
): T | undefined {
  if (!appointment.patientId) return undefined;
  const apptDay = appointment.startTime.toDateString();
  return invoices.find(
    (inv) =>
      inv.patientId === appointment.patientId &&
      !alreadyAttributed.has(inv.id) &&
      inv.createdAt.toDateString() === apptDay,
  );
}
