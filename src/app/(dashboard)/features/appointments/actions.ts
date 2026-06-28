"use server";

import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { broadcastAppointmentUpdate } from "@/lib/pusher";
import { predictNoShowRisk } from "@/lib/ai";
import {
  maybeCreateRecallAfterAppointment,
  refreshPatientRiskScores,
} from "@/lib/recall/helpers";
import { conflictMessage, findSchedulingConflicts } from "@/lib/appointments/conflicts";
import { generateAppointmentRef } from "@/lib/ids/generate-ids";
import { getStaffActor } from "@/lib/tenant/context";
import { notifyAppointmentStatus } from "@/lib/notifications/notification-service";
import { AuditAction } from "@prisma/client";
import {
  createAppointmentSchema,
  updateAppointmentChairSchema,
  updateAppointmentStatusSchema,
  updateAppointmentTimeSchema,
} from "./schemas";

export const createAppointment = createAction({
  schema: createAppointmentSchema,
  permission: () => requirePermission(PERMISSIONS.appointments.write),
  handler: async (input, ctx) => {
    const patient = await db.patient.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.patientId }),
    });
    if (!patient) throw new Error("Patient not found");

    const history = await db.appointment.groupBy({
      by: ["status"],
      where: { tenantId: ctx.tenant.id, patientId: input.patientId },
      _count: true,
    });

    const total = history.reduce((s, h) => s + h._count, 0);
    const noShows = history.find((h) => h.status === "NO_SHOW")?._count ?? 0;
    const start = new Date(input.startTime);
    const end = new Date(input.endTime);

    const conflicts = await findSchedulingConflicts(ctx.tenant.id, {
      startTime: start,
      endTime: end,
      chairId: input.chairId,
      doctorId: input.doctorId,
    });
    if (conflicts.length > 0) {
      throw new Error(conflictMessage(conflicts));
    }

    let noShowRisk = null;
    try {
      const prediction = await predictNoShowRisk({
        totalAppointments: total,
        noShows,
        cancellations: history.find((h) => h.status === "CANCELED")?._count ?? 0,
        dayOfWeek: start.toLocaleDateString("en-US", { weekday: "long" }),
        hour: start.getHours(),
        patientNoShowHistory: noShows,
      });
      noShowRisk = prediction.riskLevel;
    } catch {
      // AI optional
    }

    const appointment = await db.appointment.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: input.patientId,
        title: input.title,
        startTime: start,
        endTime: end,
        doctorId: input.doctorId,
        chairId: input.chairId,
        type: input.type,
        notes: input.notes,
        noShowRisk: noShowRisk ?? undefined,
        appointmentRef: await generateAppointmentRef(ctx.tenant.id),
      },
      include: { patient: true, chair: true, doctor: { include: { user: true } } },
    });

    await broadcastAppointmentUpdate(ctx.tenant.id, appointment);
    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.CREATE,
      entity: "Appointment",
      entityId: appointment.id,
    });
    return appointment;
  },
});

export const updateAppointmentStatus = createAction({
  schema: updateAppointmentStatusSchema,
  permission: () => requirePermission(PERMISSIONS.appointments.write),
  handler: async (input, ctx) => {
    const existing = await db.appointment.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id }),
    });
    if (!existing) throw new Error("Appointment not found");

    const appointment = await db.appointment.update({
      where: { id: input.id },
      data: { status: input.status },
      include: { patient: true, chair: true },
    });

    const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
    await notifyAppointmentStatus(
      appointment.id,
      ctx.tenant.id,
      input.status,
      patientName,
    ).catch(() => null);

    if (input.status === "COMPLETED") {
      await db.patient.update({
        where: { id: appointment.patientId },
        data: { lastVisitAt: new Date() },
      });
      await maybeCreateRecallAfterAppointment({
        tenantId: ctx.tenant.id,
        patientId: appointment.patientId,
      });
    }

    if (input.status === "NO_SHOW") {
      await db.patient.update({
        where: { id: appointment.patientId },
        data: { noShowCount: { increment: 1 } },
      });
    }

    if (input.status === "COMPLETED" || input.status === "NO_SHOW") {
      await refreshPatientRiskScores(ctx.tenant.id, appointment.patientId);
    }

    await broadcastAppointmentUpdate(ctx.tenant.id, appointment);
    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.UPDATE,
      entity: "Appointment",
      entityId: appointment.id,
      metadata: { status: input.status },
    });
    return appointment;
  },
});

export const updateAppointmentChair = createAction({
  schema: updateAppointmentChairSchema,
  permission: () => requirePermission(PERMISSIONS.appointments.write),
  handler: async (input, ctx) => {
    const existing = await db.appointment.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id }),
    });
    if (!existing) throw new Error("Appointment not found");

    if (input.chairId) {
      const chair = await db.chair.findFirst({
        where: tenantWhere(ctx.tenant.id, { id: input.chairId, isActive: true }),
      });
      if (!chair) throw new Error("Chair not found");
    }

    const appointment = await db.appointment.update({
      where: { id: input.id },
      data: { chairId: input.chairId },
      include: { patient: true, chair: true, doctor: { include: { user: true } } },
    });

    await broadcastAppointmentUpdate(ctx.tenant.id, appointment);
    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.UPDATE,
      entity: "Appointment",
      entityId: appointment.id,
      metadata: { chairId: input.chairId },
    });

    return appointment;
  },
});

export const updateAppointmentTime = createAction({
  schema: updateAppointmentTimeSchema,
  permission: () => requirePermission(PERMISSIONS.appointments.write),
  handler: async (input, ctx) => {
    const existing = await db.appointment.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id }),
    });
    if (!existing) throw new Error("Appointment not found");

    const start = new Date(input.startTime);
    const end = new Date(input.endTime);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throw new Error("Invalid time range");
    }

    const conflicts = await findSchedulingConflicts(ctx.tenant.id, {
      startTime: start,
      endTime: end,
      chairId: existing.chairId,
      doctorId: existing.doctorId,
      excludeAppointmentId: input.id,
    });
    if (conflicts.length > 0) {
      throw new Error(conflictMessage(conflicts));
    }

    const appointment = await db.appointment.update({
      where: { id: input.id },
      data: { startTime: start, endTime: end },
      include: { patient: true, chair: true, doctor: { include: { user: true } } },
    });

    await broadcastAppointmentUpdate(ctx.tenant.id, appointment);
    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.UPDATE,
      entity: "Appointment",
      entityId: appointment.id,
      metadata: { startTime: input.startTime, endTime: input.endTime },
    });

    return appointment;
  },
});

export async function getAppointments(
  tenantId: string,
  range?: { start: Date; end: Date },
) {
  return db.appointment.findMany({
    where: {
      tenantId,
      deletedAt: null,
      ...(range
        ? { startTime: { gte: range.start, lte: range.end } }
        : {}),
    },
    include: {
      patient: true,
      chair: true,
      doctor: { include: { user: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function getChairs(tenantId: string) {
  return db.chair.findMany({
    where: { tenantId, isActive: true },
    include: {
      doctor: { include: { user: true } },
      appointments: {
        where: {
          startTime: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
          status: { in: ["ARRIVED", "IN_CHAIR", "CONFIRMED", "SCHEDULED"] },
        },
      },
    },
    orderBy: { number: "asc" },
  });
}

export async function getDoctors(tenantId: string) {
  return db.doctor.findMany({
    where: { tenantId },
    include: { user: true },
    orderBy: { user: { lastName: "asc" } },
  });
}
