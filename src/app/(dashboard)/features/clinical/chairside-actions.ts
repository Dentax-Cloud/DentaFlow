"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac/guard";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { ToothConditionType } from "@prisma/client";
import {
  CHAIRSIDE_CLOSED_REASON,
  CHAIRSIDE_SESSION_STATUS,
  finalizeChairsideSessionRecord,
} from "@/lib/clinical/chairside-lifecycle";
import { getOrCreateActiveChairsideSession } from "@/lib/clinical/start-chairside-session";
import { amendLockedChairsideEntry } from "@/lib/clinical/lock-chart-records";

const CHAIRSIDE_WRITE_FORBIDDEN_MESSAGE =
  "You don't have permission to start a chairside session. Contact your administrator if you believe this is incorrect.";

async function requireChairsideWrite() {
  const ctx = await requireTenantContext();
  if (!ctx.staffMember || !hasPermission(ctx.staffMember.role, PERMISSIONS.clinical_chart.write)) {
    throw new Error(CHAIRSIDE_WRITE_FORBIDDEN_MESSAGE);
  }
  return ctx;
}

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
  const ctx = await requireChairsideWrite();

  const session = await getOrCreateActiveChairsideSession({
    tenantId: ctx.tenantId,
    staffMemberId: ctx.staffMember?.id ?? null,
    patientId: input.patientId,
    appointmentId: input.appointmentId,
  });

  if (input.appointmentId) {
    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    revalidatePath("/dashboard/doctor");
  }

  return session;
}

/** Atomically mark in-chair (if needed) and start/resume a chairside session. */
export async function beginChairsideVisit(input: {
  patientId: string;
  appointmentId: string;
}) {
  const session = await startChairsideSession(input);
  revalidatePath("/clinical/chairside");
  return {
    sessionId: session.id,
    patientId: input.patientId,
    appointmentId: input.appointmentId,
  };
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
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const session = await db.chairsideSession.findFirst({
    where: {
      id: input.sessionId,
      tenantId: ctx.tenantId,
      status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
    },
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
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const entry = await db.chairsideEntry.findFirst({
    where: { id: entryId, tenantId: ctx.tenantId },
    include: { session: { select: { status: true } } },
  });
  if (!entry) throw new Error("Entry not found");
  if (entry.lockedAt || entry.session.status !== CHAIRSIDE_SESSION_STATUS.ACTIVE) {
    throw new Error("Cannot remove a locked chart entry. Add an amendment instead.");
  }

  await db.chairsideEntry.delete({ where: { id: entryId } });
  revalidatePath("/clinical/chairside");
}

export async function updateChairsideEntry(
  entryId: string,
  data: { notes?: string; quantity?: number; includeInInvoice?: boolean },
  options?: { amendReason?: string },
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const entry = await db.chairsideEntry.findFirst({
    where: { id: entryId, tenantId: ctx.tenantId },
  });
  if (!entry) throw new Error("Entry not found");

  if (entry.lockedAt) {
    await amendLockedChairsideEntry({
      tenantId: ctx.tenantId,
      entryId,
      data,
      amendedById: ctx.staffMember?.id,
      amendedByName: ctx.staffMember
        ? `${ctx.staffMember.firstName ?? ""} ${ctx.staffMember.lastName ?? ""}`.trim()
        : null,
      amendReason: options?.amendReason?.trim() || "Post-finalize amendment",
    });
  } else {
    await db.chairsideEntry.updateMany({
      where: { id: entryId, tenantId: ctx.tenantId },
      data,
    });
  }
  revalidatePath("/clinical/chairside");
}

export async function getChairsideSession(sessionId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);

  return db.chairsideSession.findFirst({
    where: { id: sessionId, tenantId: ctx.tenantId },
    include: {
      entries: { orderBy: { createdAt: "asc" } },
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
  });
}

export async function getChairsideBypassWarning(appointmentId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.appointments.read);

  const session = await db.chairsideSession.findFirst({
    where: {
      tenantId: ctx.tenantId,
      appointmentId,
      status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
    },
    include: { _count: { select: { entries: true } } },
  });

  if (!session || session._count.entries === 0) {
    return { required: false as const, entryCount: 0 };
  }

  return { required: true as const, entryCount: session._count.entries };
}

export async function finalizeChairsideSession(
  sessionId: string,
  options?: { noTreatmentReason?: string },
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const session = await db.chairsideSession.findFirst({
    where: {
      id: sessionId,
      tenantId: ctx.tenantId,
      status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
    },
    include: { entries: { where: { includeInInvoice: true } } },
  });
  if (!session) throw new Error("Session not found");

  if (session.entries.length > 0) {
    await requirePermission(PERMISSIONS.billing.write);
  }

  const result = await finalizeChairsideSessionRecord({
    sessionId,
    tenantId: ctx.tenantId,
    staffMemberId: ctx.staffMember?.id,
    closedReason: CHAIRSIDE_CLOSED_REASON.MANUAL_FINALIZE,
    allowInvoice: true,
    noTreatmentReason: options?.noTreatmentReason,
  });

  revalidatePath("/clinical/chairside");
  revalidatePath("/appointments");
  revalidatePath("/billing");
  revalidatePath("/clinical");

  return result;
}

export async function getPatientChairsideSessions(patientId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);

  return db.chairsideSession.findMany({
    where: { tenantId: ctx.tenantId, patientId },
    include: {
      entries: { orderBy: { createdAt: "asc" } },
    },
    orderBy: { startedAt: "desc" },
    take: 10,
  });
}

export async function getActiveChairsideSessionsForUser() {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);

  return db.chairsideSession.findMany({
    where: {
      tenantId: ctx.tenantId,
      status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
      ...(ctx.staffMember?.id ? { staffId: ctx.staffMember.id } : {}),
    },
    include: {
      patient: { select: { id: true, firstName: true, lastName: true } },
    },
    orderBy: { startedAt: "desc" },
  });
}
