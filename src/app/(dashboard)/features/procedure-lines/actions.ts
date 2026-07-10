"use server";

import { revalidatePath } from "next/cache";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant/context";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { createAuditLog } from "@/lib/actions/safe-action";
import { serializeDecimal } from "@/lib/utils/serialize";
import { applyDerivedAppointmentCompletion } from "@/lib/appointments/derive-completion-status";
import { updateTreatmentPlanItem } from "@/app/(dashboard)/features/clinical/treatment-plan-actions";

async function requireClinicalChartWrite() {
  const ctx = await requireTenantContext();
  if (!ctx.staffMember || !hasPermission(ctx.staffMember.role, PERMISSIONS.clinical_chart.write)) {
    throw new Error("You do not have permission to manage procedure lines.");
  }
  return ctx;
}

function isAdminOverride(role: UserRole | undefined): boolean {
  return role === UserRole.OWNER || role === UserRole.ADMIN;
}

async function assertCanCloseLine(params: {
  tenantId: string;
  line: { id: string; ownerId: string | null; status: string };
  staffMemberId: string | undefined;
  role: UserRole | undefined;
  action: "close" | "void";
}) {
  if (params.line.status !== "IN_PROGRESS") {
    throw new Error(`Only in-progress procedure lines can be ${params.action}d.`);
  }

  const isOwner = Boolean(params.line.ownerId && params.staffMemberId === params.line.ownerId);
  const override = isAdminOverride(params.role);

  if (!isOwner && !override) {
    throw new Error("You can only close or void procedure lines you own.");
  }

  if (override && !isOwner) {
    await createAuditLog({
      tenantId: params.tenantId,
      userId: params.staffMemberId,
      action: "UPDATE",
      entity: "ProcedureLine",
      entityId: params.line.id,
      metadata: {
        action: params.action,
        override: true,
        ownerId: params.line.ownerId,
      },
    });
  }
}

function isTreatmentItemComplete(status: string): boolean {
  return status === "completed" || status === "COMPLETED";
}

async function completeLinkedTreatmentItem(
  treatmentItemId: string | null,
): Promise<{ planCompletedTitle: string | null }> {
  if (!treatmentItemId) return { planCompletedTitle: null };

  const item = await db.treatmentItem.findFirst({
    where: { id: treatmentItemId },
    select: { id: true, status: true, treatmentPlanId: true },
  });
  if (!item) return { planCompletedTitle: null };

  if (!isTreatmentItemComplete(item.status)) {
    await updateTreatmentPlanItem(treatmentItemId, { status: "COMPLETED" });
  }

  const plan = await db.treatmentPlan.findFirst({
    where: { id: item.treatmentPlanId },
    select: {
      title: true,
      items: { select: { status: true } },
    },
  });
  if (!plan) return { planCompletedTitle: null };

  const allComplete = plan.items.every((i) => isTreatmentItemComplete(i.status));
  return { planCompletedTitle: allComplete ? plan.title : null };
}

export type ProcedureLineRow = {
  id: string;
  appointmentId: string;
  ownerType: string;
  ownerId: string | null;
  ownerName: string | null;
  status: string;
  procedureCode: string | null;
  procedureName: string | null;
  unitPrice: number;
  quantity: number;
  treatmentItemId: string | null;
  requiresPreAuth: boolean;
  preAuthStatus: string | null;
  closedAt: string | null;
  voidReason: string | null;
};

export async function getAppointmentProcedureLines(
  appointmentId: string,
): Promise<ProcedureLineRow[]> {
  const ctx = await requireTenantContext();
  if (!ctx.staffMember?.role || !hasPermission(ctx.staffMember.role, PERMISSIONS.clinical_chart.read)) {
    throw new Error("You do not have permission to view procedure lines.");
  }

  const lines = await db.procedureLine.findMany({
    where: { tenantId: ctx.tenantId, appointmentId },
    orderBy: [{ ownerType: "asc" }, { createdAt: "asc" }],
  });

  const ownerIds = [...new Set(lines.map((line) => line.ownerId).filter(Boolean))] as string[];
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

  return lines.map((line) => {
    const serialized = serializeDecimal(line);
    return {
      id: line.id,
      appointmentId: line.appointmentId,
      ownerType: line.ownerType,
      ownerId: line.ownerId,
      ownerName: line.ownerId ? (ownerNameById.get(line.ownerId) ?? null) : null,
      status: line.status,
      procedureCode: line.procedureCode,
      procedureName: line.procedureName,
      unitPrice: Number(serialized.unitPrice ?? 0),
      quantity: line.quantity,
      treatmentItemId: line.treatmentItemId,
      requiresPreAuth: line.requiresPreAuth,
      preAuthStatus: line.preAuthStatus,
      closedAt: line.closedAt?.toISOString() ?? null,
      voidReason: line.voidReason,
    };
  });
}

export async function createProcedureLine(input: {
  appointmentId: string;
  ownerType: "DOCTOR" | "STORE";
  ownerId?: string | null;
  procedureCode?: string | null;
  procedureName?: string | null;
  unitPrice?: number | null;
  quantity?: number;
  treatmentItemId?: string | null;
}) {
  const ctx = await requireClinicalChartWrite();

  const appointment = await db.appointment.findFirst({
    where: {
      id: input.appointmentId,
      tenantId: ctx.tenantId,
      deletedAt: null,
      isBlock: false,
    },
    select: { id: true },
  });
  if (!appointment) throw new Error("Appointment not found.");

  const ownerId =
    input.ownerType === "DOCTOR"
      ? (input.ownerId ?? ctx.staffMember?.id ?? null)
      : (input.ownerId ?? null);

  if (input.ownerType === "DOCTOR" && !ownerId) {
    throw new Error("A doctor-owned procedure line requires an owner.");
  }

  const line = await db.procedureLine.create({
    data: {
      tenantId: ctx.tenantId,
      appointmentId: input.appointmentId,
      ownerType: input.ownerType,
      ownerId,
      procedureCode: input.procedureCode ?? null,
      procedureName: input.procedureName ?? null,
      unitPrice: input.unitPrice ?? 0,
      quantity: input.quantity ?? 1,
      treatmentItemId: input.treatmentItemId ?? null,
      status: "IN_PROGRESS",
    },
  });

  revalidatePath("/clinical/chairside");
  revalidatePath("/clinical/visit-board");
  revalidatePath("/appointments");

  return { id: line.id };
}

export async function closeProcedureLine(lineId: string) {
  const ctx = await requireClinicalChartWrite();

  const line = await db.procedureLine.findFirst({
    where: { id: lineId, tenantId: ctx.tenantId },
  });
  if (!line) throw new Error("Procedure line not found.");

  await assertCanCloseLine({
    tenantId: ctx.tenantId,
    line,
    staffMemberId: ctx.staffMember?.id,
    role: ctx.staffMember?.role,
    action: "close",
  });

  await db.procedureLine.update({
    where: { id: lineId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: ctx.staffMember?.id ?? null,
    },
  });

  const completion = await applyDerivedAppointmentCompletion(ctx.tenantId, line.appointmentId);
  const treatmentSync = await completeLinkedTreatmentItem(line.treatmentItemId);

  revalidatePath("/clinical/chairside");
  revalidatePath("/clinical/visit-board");
  revalidatePath("/appointments");
  if (line.treatmentItemId) {
    revalidatePath("/clinical/treatment-plans");
  }

  return {
    completionApplied: completion.applied,
    planCompletedTitle: treatmentSync.planCompletedTitle,
  };
}

export async function voidProcedureLine(lineId: string, reason: string) {
  const ctx = await requireClinicalChartWrite();
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A void reason is required.");

  const line = await db.procedureLine.findFirst({
    where: { id: lineId, tenantId: ctx.tenantId },
  });
  if (!line) throw new Error("Procedure line not found.");

  await assertCanCloseLine({
    tenantId: ctx.tenantId,
    line,
    staffMemberId: ctx.staffMember?.id,
    role: ctx.staffMember?.role,
    action: "void",
  });

  await db.procedureLine.update({
    where: { id: lineId },
    data: {
      status: "VOIDED",
      voidReason: trimmedReason,
      closedAt: new Date(),
      closedById: ctx.staffMember?.id ?? null,
    },
  });

  const completion = await applyDerivedAppointmentCompletion(ctx.tenantId, line.appointmentId);

  revalidatePath("/clinical/chairside");
  revalidatePath("/clinical/visit-board");
  revalidatePath("/appointments");

  return { completionApplied: completion.applied };
}

export async function forceCloseProcedureLine(lineId: string, reason: string) {
  const ctx = await requireTenantContext();
  const trimmedReason = reason.trim();
  if (!trimmedReason) throw new Error("A reason is required for force-close.");

  if (!ctx.staffMember || !isAdminOverride(ctx.staffMember.role)) {
    throw new Error("Only administrators can force-close procedure lines.");
  }

  const line = await db.procedureLine.findFirst({
    where: { id: lineId, tenantId: ctx.tenantId },
  });
  if (!line) throw new Error("Procedure line not found.");
  if (line.status !== "IN_PROGRESS") {
    throw new Error("Only in-progress procedure lines can be force-closed.");
  }

  await db.procedureLine.update({
    where: { id: lineId },
    data: {
      status: "CLOSED",
      closedAt: new Date(),
      closedById: ctx.staffMember.id,
    },
  });

  await createAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.staffMember.id,
    action: "UPDATE",
    entity: "ProcedureLine",
    entityId: line.id,
    metadata: {
      action: "force_close",
      forced: true,
      reason: trimmedReason,
      previousOwnerId: line.ownerId,
      appointmentId: line.appointmentId,
    },
  });

  const completion = await applyDerivedAppointmentCompletion(ctx.tenantId, line.appointmentId);
  const treatmentSync = await completeLinkedTreatmentItem(line.treatmentItemId);

  revalidatePath("/clinical/chairside");
  revalidatePath("/clinical/visit-board");
  revalidatePath("/appointments");
  if (line.treatmentItemId) {
    revalidatePath("/clinical/treatment-plans");
  }

  return {
    completionApplied: completion.applied,
    planCompletedTitle: treatmentSync.planCompletedTitle,
  };
}
