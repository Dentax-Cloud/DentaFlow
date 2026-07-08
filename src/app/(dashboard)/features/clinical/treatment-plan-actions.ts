"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { generateInvoiceNumber } from "@/lib/utils";
import { calculateInvoiceTaxAndLines } from "@/lib/billing/calculate-invoice-tax";
import { getVisitNumber, normalizeItemStatus } from "@/lib/clinical/treatment-plan-types";
import { assertCanStartTreatment } from "@/lib/insurance/pre-auth-gate";
import { clinicLocalToUtc, resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";

async function recalculatePlanTotal(planId: string) {
  const items = await db.treatmentItem.findMany({ where: { treatmentPlanId: planId } });
  const total = items.reduce((sum, i) => sum + Number(i.totalCost ?? 0), 0);
  await db.treatmentPlan.update({
    where: { id: planId },
    data: { totalCost: total, totalEstimate: total },
  });
}

function parseToothNumbers(value?: string | null): string[] {
  if (!value?.trim()) return [];
  return value
    .split(/[,;\s]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function proposeTreatmentPlan(planId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const plan = await db.treatmentPlan.update({
    where: { id: planId, tenantId: ctx.tenantId },
    data: { status: "PROPOSED", presentedAt: new Date() },
  });
  revalidatePath("/clinical/treatment-plans");
  revalidatePath(`/clinical/treatment-plans/${planId}`);
  return plan;
}

export async function acceptTreatmentPlan(planId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const plan = await db.treatmentPlan.update({
    where: { id: planId, tenantId: ctx.tenantId },
    data: {
      status: "ACCEPTED",
      acceptedAt: new Date(),
      acceptedBy: ctx.staffMember?.id ?? null,
    },
  });
  revalidatePath("/clinical/treatment-plans");
  revalidatePath(`/clinical/treatment-plans/${planId}`);
  return plan;
}

export async function declineTreatmentPlan(planId: string, reason?: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const plan = await db.treatmentPlan.update({
    where: { id: planId, tenantId: ctx.tenantId },
    data: {
      status: "DECLINED",
      rejectedAt: new Date(),
      rejectedReason: reason ?? null,
    },
  });
  revalidatePath("/clinical/treatment-plans");
  revalidatePath(`/clinical/treatment-plans/${planId}`);
  return plan;
}

export async function completeTreatmentPlan(planId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const plan = await db.treatmentPlan.update({
    where: { id: planId, tenantId: ctx.tenantId },
    data: { status: "COMPLETED" },
  });
  revalidatePath("/clinical/treatment-plans");
  revalidatePath(`/clinical/treatment-plans/${planId}`);
  return plan;
}

export async function startTreatmentPlan(planId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { countryCode: true },
  });
  await assertCanStartTreatment(
    ctx.tenantId,
    planId,
    tenant?.countryCode ?? "AE",
  );

  const plan = await db.treatmentPlan.update({
    where: { id: planId, tenantId: ctx.tenantId },
    data: { status: "IN_PROGRESS" },
  });
  revalidatePath(`/clinical/treatment-plans/${planId}`);
  return plan;
}

export async function reviseTreatmentPlan(planId: string, reason?: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const original = await db.treatmentPlan.findFirst({
    where: { id: planId, tenantId: ctx.tenantId, deletedAt: null },
    include: { items: true },
  });
  if (!original) throw new Error("Plan not found");

  const revised = await db.treatmentPlan.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: original.patientId,
      title: `${original.title} (Revised)`,
      description: reason
        ? `Revised from v${original.version}: ${reason}`
        : original.description,
      status: "DRAFT",
      version: original.version + 1,
      parentPlanId: original.parentPlanId ?? original.id,
      items: {
        create: original.items.map((item) => {
          const visit = getVisitNumber(item);
          const cost = Number(item.totalCost ?? 0);
          return {
            tenantId: ctx.tenantId,
            description: item.description,
            unitCost: cost,
            totalCost: cost,
            status: "pending",
            visitNumber: visit,
            phase: visit,
            priority: item.priority ?? "ELECTIVE",
            toothNumbers: item.toothNumbers,
            surfaces: item.surfaces,
            procedureCatalogId: item.procedureCatalogId,
            procedureCode: item.procedureCode,
            estimatedDuration: item.estimatedDuration,
          };
        }),
      },
    },
    include: { items: true },
  });

  await recalculatePlanTotal(revised.id);
  revalidatePath("/clinical/treatment-plans");
  return revised;
}

export async function addTreatmentPlanItem(
  planId: string,
  data: {
    description: string;
    estimatedCost: number;
    visitNumber?: number;
    priority?: string;
    toothNumbers?: string;
    surfaces?: string;
    notes?: string;
    procedureCatalogId?: string;
    estimatedDuration?: number;
  },
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const plan = await db.treatmentPlan.findFirst({
    where: { id: planId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!plan) throw new Error("Plan not found");

  let description = data.description;
  let cost = data.estimatedCost;
  let procedureCode: string | null = null;
  let duration = data.estimatedDuration ?? null;

  if (data.procedureCatalogId) {
    const proc = await db.procedureCatalog.findFirst({
      where: { id: data.procedureCatalogId, tenantId: ctx.tenantId, isActive: true },
    });
    if (proc) {
      description = proc.name;
      cost = Number(proc.price);
      procedureCode = proc.code;
      duration = proc.duration ?? duration;
    }
  }

  const visit = data.visitNumber ?? 1;
  const item = await db.treatmentItem.create({
    data: {
      tenantId: ctx.tenantId,
      treatmentPlanId: planId,
      description: data.notes ? `${description} — ${data.notes}` : description,
      unitCost: cost,
      totalCost: cost,
      status: "pending",
      visitNumber: visit,
      phase: visit,
      priority: data.priority ?? "ELECTIVE",
      toothNumbers: parseToothNumbers(data.toothNumbers),
      surfaces: data.surfaces ?? null,
      procedureCatalogId: data.procedureCatalogId ?? null,
      procedureCode,
      estimatedDuration: duration,
    },
  });

  await recalculatePlanTotal(planId);
  revalidatePath(`/clinical/treatment-plans/${planId}`);
  return item;
}

export async function updateTreatmentPlanItem(
  itemId: string,
  data: {
    description?: string;
    estimatedCost?: number;
    visitNumber?: number;
    priority?: string;
    status?: string;
    notes?: string;
    toothNumbers?: string;
  },
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const item = await db.treatmentItem.findFirst({
    where: { id: itemId, tenantId: ctx.tenantId },
    include: { treatmentPlan: { select: { id: true, tenantId: true } } },
  });
  if (!item || item.treatmentPlan.tenantId !== ctx.tenantId) {
    throw new Error("Item not found");
  }

  const nextStatus = data.status?.toLowerCase();
  const updated = await db.treatmentItem.update({
    where: { id: itemId },
    data: {
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.estimatedCost !== undefined
        ? { unitCost: data.estimatedCost, totalCost: data.estimatedCost }
        : {}),
      ...(data.visitNumber !== undefined
        ? { visitNumber: data.visitNumber, phase: data.visitNumber }
        : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.toothNumbers !== undefined
        ? { toothNumbers: parseToothNumbers(data.toothNumbers) }
        : {}),
      ...(nextStatus !== undefined ? { status: nextStatus } : {}),
      ...(nextStatus === "completed" || data.status === "COMPLETED"
        ? {
            completedAt: new Date(),
            completedByStaffId: ctx.staffMember?.id ?? null,
          }
        : {}),
    },
  });

  await recalculatePlanTotal(item.treatmentPlan.id);
  revalidatePath(`/clinical/treatment-plans/${item.treatmentPlan.id}`);
  return updated;
}

export async function removeTreatmentPlanItem(itemId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const item = await db.treatmentItem.findFirst({
    where: { id: itemId, tenantId: ctx.tenantId },
    include: { treatmentPlan: { select: { id: true } } },
  });
  if (!item) throw new Error("Item not found");

  await db.treatmentItem.delete({ where: { id: itemId } });
  await recalculatePlanTotal(item.treatmentPlan.id);
  revalidatePath(`/clinical/treatment-plans/${item.treatmentPlan.id}`);
}

export async function scheduleVisitAppointment(
  planId: string,
  visitNumber: number,
  data: {
    date: string;
    time: string;
    duration: number;
    doctorId?: string;
    branchId?: string;
  },
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.appointments.write);

  const plan = await db.treatmentPlan.findFirst({
    where: { id: planId, tenantId: ctx.tenantId, deletedAt: null },
    include: { items: { where: { visitNumber } } },
  });
  if (!plan) throw new Error("Plan not found");

  const clinicTz = resolveClinicTimezone(ctx.tenant.timezone);
  const startTime = clinicLocalToUtc(data.date, data.time, clinicTz);
  const endTime = new Date(startTime.getTime() + data.duration * 60 * 1000);

  const chair = await db.chair.findFirst({
    where: {
      tenantId: ctx.tenantId,
      isActive: true,
      ...(data.branchId ? { branchId: data.branchId } : {}),
    },
  });

  const appointment = await db.appointment.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: plan.patientId,
      doctorId: data.doctorId ?? null,
      chairId: chair?.id ?? null,
      branchId: data.branchId ?? chair?.branchId ?? null,
      title: `${plan.title} — Visit ${visitNumber}`,
      startTime,
      endTime,
      status: "SCHEDULED",
      notes: `Treatment plan ${plan.id} · Visit ${visitNumber}`,
    },
  });

  await db.treatmentItem.updateMany({
    where: { treatmentPlanId: planId, visitNumber, tenantId: ctx.tenantId },
    data: {
      linkedAppointmentId: appointment.id,
      status: "scheduled",
    },
  });

  if (plan.status === "DRAFT" || plan.status === "PROPOSED" || plan.status === "ACCEPTED") {
    await db.treatmentPlan.update({
      where: { id: planId },
      data: { status: "IN_PROGRESS" },
    });
  }

  revalidatePath(`/clinical/treatment-plans/${planId}`);
  revalidatePath("/appointments");
  return appointment;
}

export async function generateInvoiceFromPlan(
  planId: string,
  options?: { visitNumber?: number; itemIds?: string[] },
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.billing.write);

  const plan = await db.treatmentPlan.findFirst({
    where: { id: planId, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      items: {
        where: {
          ...(options?.visitNumber ? { visitNumber: options.visitNumber } : {}),
          ...(options?.itemIds ? { id: { in: options.itemIds } } : {}),
          NOT: { status: { in: ["declined", "DECLINED"] } },
        },
      },
      patient: true,
    },
  });
  if (!plan) throw new Error("Plan not found");
  if (!plan.items.length) throw new Error("No items to invoice");

  const taxResult = await calculateInvoiceTaxAndLines({
    tenantId: ctx.tenantId,
    patientId: plan.patientId,
    items: plan.items.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: Number(item.unitCost),
      procedureCode: item.procedureCode ?? undefined,
    })),
  });

  const count = await db.invoice.count({ where: { tenantId: ctx.tenantId } });
  const invoice = await db.invoice.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: plan.patientId,
      invoiceNumber: generateInvoiceNumber(count + 1),
      status: "DRAFT",
      subtotal: taxResult.subtotal,
      tax: taxResult.tax,
      total: taxResult.total,
      exemptSubtotal: taxResult.exemptSubtotal,
      taxableSubtotal: taxResult.taxableSubtotal,
      cgstTotal: taxResult.cgstTotal,
      sgstTotal: taxResult.sgstTotal,
      igstTotal: taxResult.igstTotal,
      currency: taxResult.currency,
      taxName: taxResult.taxName,
      taxRateApplied: taxResult.taxRateApplied,
      taxNumber: taxResult.taxNumber,
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      notes: `Treatment Plan: ${plan.title}${
        options?.visitNumber ? ` — Visit ${options.visitNumber}` : ""
      }`,
      items: {
        create: taxResult.lines.map((line) => ({
          tenantId: ctx.tenantId,
          description: line.description,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          total: line.total,
          procedureCode: line.procedureCode,
          inventoryItemId: line.inventoryItemId,
          itemType: line.itemType,
          hsnSacCode: line.hsnSacCode,
          gstRate: line.gstRate,
          cgstAmount: line.cgstAmount,
          sgstAmount: line.sgstAmount,
          igstAmount: line.igstAmount,
        })),
      },
    },
    include: { items: true },
  });

  await db.treatmentItem.updateMany({
    where: { id: { in: plan.items.map((i) => i.id) } },
    data: { status: "completed", completedAt: new Date() },
  });

  revalidatePath("/billing");
  revalidatePath(`/clinical/treatment-plans/${planId}`);
  return invoice;
}

export async function createPlanShareLink(planId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const plan = await db.treatmentPlan.findFirst({
    where: { id: planId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!plan) throw new Error("Plan not found");

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await db.treatmentPlanShare.create({
    data: {
      planId,
      tenantId: ctx.tenantId,
      token,
      expiresAt,
    },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const shareUrl = `${baseUrl}/plan/${token}`;
  revalidatePath(`/clinical/treatment-plans/${planId}`);
  return { shareUrl, token, expiresAt };
}

export async function getTreatmentPlanWithItems(planId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_schedule.read);

  return db.treatmentPlan.findFirst({
    where: { id: planId, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      items: { orderBy: [{ visitNumber: "asc" }, { priority: "asc" }] },
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getPatientTreatmentPlans(patientId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_schedule.read);

  return db.treatmentPlan.findMany({
    where: { patientId, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      items: {
        select: {
          id: true,
          status: true,
          totalCost: true,
          visitNumber: true,
          phase: true,
          priority: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function createTreatmentPlanRecord(input: {
  patientId: string;
  title: string;
  notes?: string;
}) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const patient = await db.patient.findFirst({
    where: tenantWhere(ctx.tenantId, { id: input.patientId, deletedAt: null }),
  });
  if (!patient) throw new Error("Patient not found");

  const plan = await db.treatmentPlan.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      title: input.title.trim(),
      description: input.notes?.trim() || null,
      status: "DRAFT",
    },
  });

  revalidatePath("/clinical/treatment-plans");
  return plan;
}
