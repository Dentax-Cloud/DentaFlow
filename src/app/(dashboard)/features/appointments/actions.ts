"use server";

import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import {
  autoCloseChairsideSessionsForAppointment,
  isTerminalAppointmentStatus,
} from "@/lib/clinical/chairside-lifecycle";
import { completeVisit } from "@/lib/clinical/complete-visit";
import { tenantWhere } from "@/lib/tenant/scoped";
import { broadcastAppointmentUpdate } from "@/lib/pusher";
import { refreshPatientRiskScores } from "@/lib/recall/helpers";
import { conflictMessage, findSchedulingConflicts } from "@/lib/appointments/conflicts";
import {
  clinicLocalToUtc,
  resolveClinicTimezone,
} from "@/lib/datetime/clinic-timezone";
import { getStaffActor, requireTenantContext } from "@/lib/tenant/context";
import { notifyAppointmentStatus } from "@/lib/notifications/notification-service";
import { AuditAction, AppointmentStatus } from "@prisma/client";
import {
  createBlockTimeSchema,
  updateAppointmentChairSchema,
  updateAppointmentStatusSchema,
  updateAppointmentTimeSchema,
} from "./schemas";

export const createBlockTime = createAction({
  schema: createBlockTimeSchema,
  permission: () => requirePermission(PERMISSIONS.appointments.write),
  handler: async (input, ctx) => {
    const clinicTz = resolveClinicTimezone(ctx.tenant.timezone);
    const start = clinicLocalToUtc(input.startDate, input.startTime, clinicTz);
    const end = clinicLocalToUtc(input.endDate, input.endTime, clinicTz);

    const conflicts = await findSchedulingConflicts(ctx.tenant.id, {
      startTime: start,
      endTime: end,
      chairId: input.chairId,
      doctorId: input.doctorId,
    });
    if (conflicts.length > 0) {
      throw new Error(conflictMessage(conflicts));
    }

    if (input.doctorId) {
      const doctor = await db.doctor.findFirst({
        where: tenantWhere(ctx.tenant.id, { id: input.doctorId }),
      });
      if (!doctor) throw new Error("Doctor not found");
    }

    if (input.chairId) {
      const chair = await db.chair.findFirst({
        where: tenantWhere(ctx.tenant.id, { id: input.chairId, isActive: true }),
      });
      if (!chair) throw new Error("Chair not found");
    }

    const appointment = await db.appointment.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: null,
        isBlock: true,
        title: input.title,
        startTime: start,
        endTime: end,
        doctorId: input.doctorId,
        chairId: input.chairId,
        notes: input.notes,
        status: "SCHEDULED",
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
      metadata: { isBlock: true },
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

    if (existing.isBlock) {
      if (input.status !== "CANCELED") {
        throw new Error("Blocked time can only be removed by canceling the block");
      }
      const appointment = await db.appointment.update({
        where: { id: input.id },
        data: { status: "CANCELED" },
        include: { patient: true, chair: true, doctor: { include: { user: true } } },
      });
      await broadcastAppointmentUpdate(ctx.tenant.id, appointment);
      await createAuditLog({
        tenantId: ctx.tenant.id,
        userId: getStaffActor(ctx).id,
        action: AuditAction.UPDATE,
        entity: "Appointment",
        entityId: appointment.id,
        metadata: { status: input.status, isBlock: true },
      });
      return appointment;
    }

    if (input.status === "COMPLETED") {
      const allowInvoice =
        Boolean(ctx.staffMember) &&
        hasPermission(ctx.staffMember!.role, PERMISSIONS.billing.write);

      const appointment = await completeVisit({
        tenantId: ctx.tenant.id,
        appointmentId: input.id,
        staffMemberId: ctx.staffMember?.id,
        allowInvoice,
      });

      if (!appointment) throw new Error("Appointment not found");

      await createAuditLog({
        tenantId: ctx.tenant.id,
        userId: getStaffActor(ctx).id,
        action: AuditAction.UPDATE,
        entity: "Appointment",
        entityId: appointment.id,
        metadata: { status: input.status },
      });
      return appointment;
    }

    const appointment = await db.appointment.update({
      where: { id: input.id },
      data: { status: input.status },
      include: { patient: true, chair: true, doctor: { include: { user: true } } },
    });

    if (appointment.patient) {
      const patientName = `${appointment.patient.firstName} ${appointment.patient.lastName}`;
      await notifyAppointmentStatus(
        appointment.id,
        ctx.tenant.id,
        input.status,
        patientName,
      ).catch(() => null);
    }

    if (input.status === "NO_SHOW" && appointment.patientId) {
      await db.patient.update({
        where: { id: appointment.patientId },
        data: { noShowCount: { increment: 1 } },
      });
    }

    if (input.status === "NO_SHOW" && appointment.patientId) {
      await refreshPatientRiskScores(ctx.tenant.id, appointment.patientId);
    }

    if (isTerminalAppointmentStatus(input.status)) {
      const allowInvoice =
        Boolean(ctx.staffMember) &&
        hasPermission(ctx.staffMember!.role, PERMISSIONS.billing.write);
      await autoCloseChairsideSessionsForAppointment({
        tenantId: ctx.tenant.id,
        appointmentId: appointment.id,
        appointmentStatus: input.status,
        staffMemberId: ctx.staffMember?.id,
        allowInvoice,
      }).catch(() => null);
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
    if (existing.isBlock) throw new Error("Chair assignment does not apply to blocked time");

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

    const clinicTz = resolveClinicTimezone(ctx.tenant.timezone);
    const start = clinicLocalToUtc(input.startDate, input.startTime, clinicTz);
    const end = clinicLocalToUtc(input.endDate, input.endTime, clinicTz);
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
      metadata: {
        startDate: input.startDate,
        startTime: input.startTime,
        endDate: input.endDate,
        endTime: input.endTime,
      },
    });

    return appointment;
  },
});

export async function getAppointments(
  range?: { start: Date; end: Date },
  options?: { includeCanceled?: boolean },
) {
  const ctx = await requireTenantContext();
  const statusFilter = options?.includeCanceled
    ? {}
    : { status: { notIn: [AppointmentStatus.CANCELED, AppointmentStatus.NO_SHOW] } };

  return db.appointment.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...statusFilter,
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

export async function getChairs() {
  const ctx = await requireTenantContext();
  return db.chair.findMany({
    where: { tenantId: ctx.tenantId, isActive: true },
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

export async function getDoctors() {
  const ctx = await requireTenantContext();
  return db.doctor.findMany({
    where: { tenantId: ctx.tenantId },
    include: { user: true },
    orderBy: { user: { lastName: "asc" } },
  });
}
