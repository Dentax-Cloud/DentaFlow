"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { serializeDecimal } from "@/lib/utils/serialize";
import { createInvoiceFromItems } from "@/lib/billing/invoice-from-items";
import {
  buildVisitInvoiceNotes,
  countDistinctVisitInvoices,
  mapProcedureLinesToInvoiceItems,
  selectBillableProcedureLines,
  type ProcedureLineBillable,
} from "@/lib/billing/procedure-line-invoice";

export type GenerateInvoiceFromProcedureLinesOptions = {
  linesOnly?: string[];
};

export async function generateInvoiceFromProcedureLines(
  appointmentId: string,
  options?: GenerateInvoiceFromProcedureLinesOptions,
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.billing.write);

  const appointment = await db.appointment.findFirst({
    where: {
      id: appointmentId,
      tenantId: ctx.tenantId,
      deletedAt: null,
      isBlock: false,
    },
    select: {
      id: true,
      patientId: true,
      status: true,
      appointmentRef: true,
    },
  });

  if (!appointment?.patientId) {
    throw new Error("Appointment not found.");
  }

  const rawLines = await db.procedureLine.findMany({
    where: { tenantId: ctx.tenantId, appointmentId },
    orderBy: [{ ownerType: "asc" }, { createdAt: "asc" }],
  });

  const ownerIds = [
    ...new Set(rawLines.map((line) => line.ownerId).filter((id): id is string => Boolean(id))),
  ];
  const owners =
    ownerIds.length > 0
      ? await db.staffMember.findMany({
          where: { tenantId: ctx.tenantId, id: { in: ownerIds } },
          select: { id: true, firstName: true, lastName: true },
        })
      : [];
  const ownerNameById = new Map(
    owners.map((owner) => [
      owner.id,
      `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim() || "Staff",
    ]),
  );

  const serializedLines: ProcedureLineBillable[] = rawLines.map((line) => {
    const serialized = serializeDecimal(line);
    return {
      id: line.id,
      ownerType: line.ownerType,
      ownerId: line.ownerId,
      ownerName: line.ownerId ? (ownerNameById.get(line.ownerId) ?? null) : null,
      status: line.status,
      procedureCode: line.procedureCode,
      procedureName: line.procedureName,
      unitPrice: Number(serialized.unitPrice ?? 0),
      quantity: line.quantity,
      lockedAt: line.lockedAt,
      lockedInvoiceId: line.lockedInvoiceId,
      itemType: line.ownerType === "STORE" ? "GOOD" : "SERVICE",
    };
  });

  const billable = selectBillableProcedureLines(serializedLines, options?.linesOnly);
  if (billable.length === 0) {
    throw new Error("No billable closed procedure lines are available for invoicing.");
  }

  const existingVisitInvoiceCount = countDistinctVisitInvoices(
    serializedLines.map((line) => line.lockedInvoiceId),
  );
  const visitInvoiceNumber = existingVisitInvoiceCount + 1;
  const isInterim = appointment.status !== "COMPLETED";

  const items = mapProcedureLinesToInvoiceItems(billable);
  const notes = buildVisitInvoiceNotes({
    appointmentId: appointment.id,
    appointmentRef: appointment.appointmentRef,
    visitInvoiceNumber,
    isInterim,
  });

  const invoice = await createInvoiceFromItems({
    tenantId: ctx.tenantId,
    patientId: appointment.patientId,
    items,
    notes,
    status: "DRAFT",
  });

  const now = new Date();
  const lockResult = await db.procedureLine.updateMany({
    where: {
      tenantId: ctx.tenantId,
      id: { in: billable.map((line) => line.id) },
      status: "CLOSED",
      lockedAt: null,
    },
    data: {
      status: "LOCKED",
      lockedAt: now,
      lockedInvoiceId: invoice.id,
    },
  });

  if (lockResult.count !== billable.length) {
    throw new Error(
      "Invoice was created but some procedure lines could not be locked. Review billing before retrying.",
    );
  }

  revalidatePath("/billing/ready-to-invoice");
  revalidatePath("/billing");
  revalidatePath("/clinical/chairside");
  revalidatePath("/clinical/visit-board");

  return {
    invoiceId: invoice.id,
    invoiceRef: invoice.invoiceRef,
    total: Number(invoice.total),
    visitInvoiceNumber,
    lockedLineIds: billable.map((line) => line.id),
  };
}
