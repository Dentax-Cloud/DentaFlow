"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { generateInvoiceNumber } from "@/lib/utils";
import { getTenantInvoiceTax } from "@/lib/billing/tenant-invoice-tax";
import { ToothConditionType } from "@prisma/client";

async function upsertTooth(tenantId: string, patientId: string, toothNumber: number) {
  const number = String(toothNumber);
  let tooth = await db.tooth.findUnique({
    where: {
      tenantId_patientId_number: { tenantId, patientId, number },
    },
  });
  if (!tooth) {
    tooth = await db.tooth.create({
      data: { tenantId, patientId, number },
    });
  }
  return tooth;
}

function parseConditionType(value: string): ToothConditionType | null {
  if (Object.values(ToothConditionType).includes(value as ToothConditionType)) {
    return value as ToothConditionType;
  }
  return null;
}

export async function startChairsideSession(input: {
  patientId: string;
  appointmentId?: string;
}) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.write);

  const patient = await db.patient.findFirst({
    where: { id: input.patientId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!patient) throw new Error("Patient not found");

  if (input.appointmentId) {
    const existing = await db.chairsideSession.findFirst({
      where: {
        tenantId: ctx.tenantId,
        appointmentId: input.appointmentId,
        status: "ACTIVE",
      },
      include: { entries: { orderBy: { createdAt: "asc" } } },
    });
    if (existing) return existing;
  }

  return db.chairsideSession.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      appointmentId: input.appointmentId ?? null,
      staffId: ctx.staffMember?.id ?? null,
      status: "ACTIVE",
    },
    include: { entries: { orderBy: { createdAt: "asc" } } },
  });
}

export async function addChairsideEntry(input: {
  sessionId: string;
  toothNumber?: number;
  surface?: string;
  procedureCode?: string;
  procedureName?: string;
  conditionType?: string;
  notes?: string;
  unitPrice?: number;
  quantity?: number;
  includeInInvoice?: boolean;
}) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.write);

  const session = await db.chairsideSession.findFirst({
    where: { id: input.sessionId, tenantId: ctx.tenantId, status: "ACTIVE" },
  });
  if (!session) throw new Error("Session not found or not active");

  if (input.toothNumber && input.conditionType) {
    const conditionType = parseConditionType(input.conditionType);
    if (conditionType) {
      try {
        const tooth = await upsertTooth(ctx.tenantId, session.patientId, input.toothNumber);
        await db.toothCondition.create({
          data: {
            tenantId: ctx.tenantId,
            patientId: session.patientId,
            toothId: tooth.id,
            type: conditionType,
            surfaces: input.surface ? [input.surface] : [],
            notes: input.notes ?? null,
            appointmentId: session.appointmentId,
            recordedBy: ctx.staffMember?.id ?? ctx.authUserId,
          },
        });
        revalidatePath("/clinical");
      } catch {
        // Don't fail if condition already exists
      }
    }
  }

  const entry = await db.chairsideEntry.create({
    data: {
      sessionId: input.sessionId,
      tenantId: ctx.tenantId,
      toothNumber: input.toothNumber ?? null,
      surface: input.surface ?? null,
      procedureCode: input.procedureCode ?? null,
      procedureName: input.procedureName ?? null,
      conditionType: input.conditionType ?? null,
      notes: input.notes ?? null,
      unitPrice: input.unitPrice ?? 0,
      quantity: input.quantity ?? 1,
      includeInInvoice: input.includeInInvoice ?? true,
    },
  });

  revalidatePath("/clinical/chairside");
  return entry;
}

export async function removeChairsideEntry(entryId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.write);

  const entry = await db.chairsideEntry.findFirst({
    where: { id: entryId, tenantId: ctx.tenantId },
  });
  if (!entry) throw new Error("Entry not found");

  await db.chairsideEntry.delete({ where: { id: entryId } });
  revalidatePath("/clinical/chairside");
}

export async function updateChairsideEntry(
  entryId: string,
  data: { notes?: string; quantity?: number; includeInInvoice?: boolean },
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.write);

  await db.chairsideEntry.updateMany({
    where: { id: entryId, tenantId: ctx.tenantId },
    data,
  });
  revalidatePath("/clinical/chairside");
}

export async function getChairsideSession(sessionId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.read);

  return db.chairsideSession.findFirst({
    where: { id: sessionId, tenantId: ctx.tenantId },
    include: {
      entries: { orderBy: { createdAt: "asc" } },
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function finalizeChairsideSession(sessionId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.write);

  const session = await db.chairsideSession.findFirst({
    where: { id: sessionId, tenantId: ctx.tenantId, status: "ACTIVE" },
    include: {
      entries: { where: { includeInInvoice: true } },
      patient: true,
    },
  });
  if (!session) throw new Error("Session not found");

  let invoiceId: string | null = null;

  if (session.entries.length > 0) {
    await requirePermission(PERMISSIONS.billing.write);

    const items = session.entries.map((e) => {
      const unitPrice = Number(e.unitPrice ?? 0);
      return {
        tenantId: ctx.tenantId,
        description: e.procedureName ?? e.conditionType ?? "Treatment",
        quantity: e.quantity,
        unitPrice,
        total: unitPrice * e.quantity,
        procedureCode: e.procedureCode ?? null,
      };
    });

    const subtotal = items.reduce((sum, i) => sum + i.total, 0);
    const taxInfo = await getTenantInvoiceTax(ctx.tenantId);
    const tax = subtotal * taxInfo.taxRateDecimal;
    const total = subtotal + tax;

    const count = await db.invoice.count({ where: { tenantId: ctx.tenantId } });
    const invoice = await db.invoice.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: session.patientId,
        invoiceNumber: generateInvoiceNumber(count + 1),
        status: "DRAFT",
        subtotal,
        tax,
        total,
        currency: taxInfo.currency,
        taxName: taxInfo.taxName,
        taxRateApplied: taxInfo.taxRatePercent,
        taxNumber: taxInfo.taxNumber,
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: session.appointmentId
          ? `Chairside session · Appointment ${session.appointmentId}`
          : "Chairside session",
        items: { create: items },
      },
    });
    invoiceId = invoice.id;
  }

  if (session.appointmentId) {
    await db.appointment
      .updateMany({
        where: tenantWhere(ctx.tenantId, { id: session.appointmentId }),
        data: { status: "COMPLETED" },
      })
      .catch(() => null);
  }

  await db.chairsideSession.update({
    where: { id: sessionId },
    data: {
      status: "FINALIZED",
      finalizedAt: new Date(),
      invoiceId,
    },
  });

  await db.auditLog
    .create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.staffMember?.id,
        performedById: ctx.staffMember?.id,
        action: "CREATE",
        entity: "ChairsideSession",
        entityId: sessionId,
        metadata: {
          patientId: session.patientId,
          entriesCount: session.entries.length,
          invoiceId,
          finalized: true,
        },
      },
    })
    .catch(() => null);

  revalidatePath("/clinical/chairside");
  revalidatePath("/appointments");
  revalidatePath("/billing");
  revalidatePath("/clinical");

  return { invoiceId };
}

export async function getPatientChairsideSessions(patientId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.read);

  return db.chairsideSession.findMany({
    where: { tenantId: ctx.tenantId, patientId },
    include: {
      entries: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
    take: 10,
  });
}
