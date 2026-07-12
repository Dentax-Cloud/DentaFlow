"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getDoctorSlots } from "@/lib/appointments/availability";
import {
  clinicLocalToUtc,
  getClinicDayBounds,
  resolveClinicTimezone,
} from "@/lib/datetime/clinic-timezone";
import { notifyAppointmentStatus } from "@/lib/notifications/notification-service";
import { generateAppointmentRef } from "@/lib/ids/generate-ids";
import type { AppointmentStatus, Prisma } from "@prisma/client";

async function resolveDoctorRecordId(
  doctorId: string,
  tenantId: string,
): Promise<string | null> {
  const byDoctorId = await db.doctor.findFirst({
    where: { id: doctorId, tenantId },
    select: { id: true },
  });
  if (byDoctorId) return byDoctorId.id;

  const byStaffId = await db.doctor.findFirst({
    where: { userId: doctorId, tenantId },
    select: { id: true },
  });
  return byStaffId?.id ?? null;
}

export async function bookAppointment(input: {
  patientId: string;
  doctorId: string;
  date: string;
  startTime: string;
  durationMins: number;
  procedureId?: string;
  branchId?: string;
  chairId?: string;
  notes?: string;
  preAuthStatus?: string;
  /** ROUTINE | SAME_DAY_WALKIN | EMERGENCY — defaults to ROUTINE */
  priority?: string;
  priorityReason?: string;
  status?: AppointmentStatus;
  type?: string;
}): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.appointments.write);

  const priority = input.priority ?? "ROUTINE";
  if (priority === "EMERGENCY" && !input.priorityReason?.trim()) {
    return {
      success: false,
      error: "Priority reason is required for emergency appointments.",
    };
  }

  const slots = await getDoctorSlots({
    tenantId: ctx.tenantId,
    doctorId: input.doctorId,
    date: input.date,
    durationMins: input.durationMins,
    branchId: input.branchId,
  });

  const slot = slots.find((s) => s.time === input.startTime);
  if (!slot?.available) {
    return {
      success: false,
      error:
        "This time slot is no longer available. " +
        "Please select another time.",
    };
  }

  const clinicTz = resolveClinicTimezone(ctx.tenant.timezone);
  const start = clinicLocalToUtc(input.date, input.startTime, clinicTz);
  const end = new Date(start.getTime() + input.durationMins * 60 * 1000);

  const doctorRecordId = await resolveDoctorRecordId(
    input.doctorId,
    ctx.tenantId,
  );
  if (!doctorRecordId) {
    return { success: false, error: "Doctor not found." };
  }

  let title = "Appointment";
  if (input.procedureId) {
    const procedure = await db.procedureCatalog.findFirst({
      where: { id: input.procedureId, tenantId: ctx.tenantId },
      select: { name: true },
    });
    if (procedure) title = procedure.name;
  } else if (priority === "SAME_DAY_WALKIN") {
    title = "Walk-in";
  }

  const appointmentId = randomUUID();
  const appointmentRef = await generateAppointmentRef(ctx.tenantId);

  const { createAppointmentWithSlotLock } =
    await import("@/lib/appointments/create-with-slot-lock");

  const locked = await createAppointmentWithSlotLock({
    id: appointmentId,
    tenantId: ctx.tenantId,
    patientId: input.patientId,
    doctorId: doctorRecordId,
    branchId: input.branchId ?? null,
    chairId: input.chairId ?? null,
    startTime: start,
    endTime: end,
    title,
    status: input.status ?? "SCHEDULED",
    type: input.type ?? null,
    notes: input.notes ?? null,
    procedureId: input.procedureId ?? null,
    bookedById: ctx.staffMember?.id ?? null,
    bookedVia: "RECEPTION",
    preAuthStatus: input.preAuthStatus ?? "NOT_REQUIRED",
    appointmentRef,
    priority,
    priorityReason: input.priorityReason?.trim() || null,
  });

  if (!locked.success) {
    return { success: false, error: locked.error };
  }

  await notifyAppointmentStatus(
    appointmentId,
    ctx.tenantId,
    input.status ?? "SCHEDULED",
    await getPatientName(ctx.tenantId, input.patientId),
  ).catch(() => null);

  revalidatePath("/appointments");
  revalidatePath("/reception");
  return { success: true, appointmentId };
}

/** Book the soonest free slot across doctors (walk-in). Never displaces existing bookings. */
export async function bookWalkInAppointment(input: {
  patientId: string;
  durationMins?: number;
  branchId?: string;
  notes?: string;
  /** If set, book this doctor/time instead of the cross-doctor soonest slot. */
  doctorId?: string;
  date?: string;
  startTime?: string;
  chairId?: string;
}): Promise<{
  success: boolean;
  appointmentId?: string;
  error?: string;
  slot?: { doctorId: string; doctorName: string; date: string; time: string };
}> {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.appointments.write);

  const durationMins = input.durationMins ?? 30;
  const clinicTz = resolveClinicTimezone(ctx.tenant.timezone);
  const { getClinicNowParts } = await import("@/lib/datetime/clinic-timezone");
  const { dateStr: today } = getClinicNowParts(clinicTz);
  const date = input.date ?? today;

  const { getNextAvailableSlotAnyDoctor } =
    await import("@/lib/appointments/availability");

  let doctorId = input.doctorId;
  let startTime = input.startTime;
  let chairId = input.chairId;
  let doctorName: string | undefined;

  if (!doctorId || !startTime) {
    const next = await getNextAvailableSlotAnyDoctor(
      ctx.tenantId,
      date,
      durationMins,
      input.branchId,
    );
    if (!next) {
      return {
        success: false,
        error: "No available slots today across any doctor.",
      };
    }
    doctorId = doctorId ?? next.doctorId;
    startTime = startTime ?? next.time;
    chairId = chairId ?? next.chairId ?? undefined;
    doctorName = next.doctorName;
  }

  const result = await bookAppointment({
    patientId: input.patientId,
    doctorId,
    date,
    startTime,
    durationMins,
    branchId: input.branchId,
    chairId,
    notes: input.notes,
    priority: "SAME_DAY_WALKIN",
    type: "WALK_IN",
    status: "ARRIVED",
  });

  if (!result.success) return result;

  if (!doctorName) {
    const staff = await db.staffMember.findFirst({
      where: { id: doctorId, tenantId: ctx.tenantId },
      select: { firstName: true, lastName: true },
    });
    doctorName = staff
      ? `Dr. ${staff.firstName ?? ""} ${staff.lastName ?? ""}`.trim()
      : "Doctor";
  }

  return {
    ...result,
    slot: { doctorId, doctorName, date, time: startTime },
  };
}

export async function getNextAvailableSlot(input: {
  date: string;
  durationMins: number;
  branchId?: string;
}) {
  const ctx = await requireTenantContext();
  const { getNextAvailableSlotAnyDoctor } =
    await import("@/lib/appointments/availability");
  return getNextAvailableSlotAnyDoctor(
    ctx.tenantId,
    input.date,
    input.durationMins,
    input.branchId,
  );
}

export async function getEmergencyDoctorOptions(input?: {
  date?: string;
  branchId?: string;
}) {
  const ctx = await requireTenantContext();
  const clinicTz = resolveClinicTimezone(ctx.tenant.timezone);
  const { getClinicNowParts } = await import("@/lib/datetime/clinic-timezone");
  const { dateStr: today } = getClinicNowParts(clinicTz);
  const { getDoctorsWithNowStatus } =
    await import("@/lib/appointments/availability");
  return getDoctorsWithNowStatus({
    tenantId: ctx.tenantId,
    date: input?.date ?? today,
    branchId: input?.branchId,
  });
}

export async function getDoctorsWithAvailability(input: {
  date: string;
  durationMins: number;
  branchId?: string;
}) {
  const ctx = await requireTenantContext();

  const { getAllDoctorAvailability } =
    await import("@/lib/appointments/availability");

  return getAllDoctorAvailability({
    tenantId: ctx.tenantId,
    date: input.date,
    durationMins: input.durationMins,
    branchId: input.branchId,
  });
}

export async function getSlotsForDoctor(input: {
  doctorId: string;
  date: string;
  durationMins: number;
  branchId?: string;
}) {
  const ctx = await requireTenantContext();

  return getDoctorSlots({
    tenantId: ctx.tenantId,
    doctorId: input.doctorId,
    date: input.date,
    durationMins: input.durationMins,
    branchId: input.branchId,
  });
}

export async function getMyAppointments(input?: {
  date?: string;
  status?: string[];
}) {
  const ctx = await requireTenantContext();

  const staffId = ctx.staffMember?.id;
  if (!staffId) throw new Error("Not authenticated");

  const doctorRecord = await db.doctor.findFirst({
    where: { userId: staffId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!doctorRecord) return [];

  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { timezone: true },
  });
  const clinicTz = resolveClinicTimezone(tenant?.timezone);
  const today =
    input?.date ?? new Date().toISOString().split("T")[0];
  const { start: dayStart, end: dayEnd } = getClinicDayBounds(today, clinicTz);

  const statusFilter: Prisma.AppointmentWhereInput = input?.status
    ? { status: { in: input.status as AppointmentStatus[] } }
    : { status: { notIn: ["CANCELED", "NO_SHOW"] } };

  return db.appointment.findMany({
    where: {
      tenantId: ctx.tenantId,
      doctorId: doctorRecord.id,
      deletedAt: null,
      startTime: {
        gte: dayStart,
        lte: dayEnd,
      },
      ...statusFilter,
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          patientId: true,
          patientNumber: true,
          phone: true,
          allergies: true,
          bloodGroup: true,
          insuranceProvider: true,
          insuranceNetwork: true,
        },
      },
      chair: { select: { id: true, name: true } },
    },
    orderBy: { startTime: "asc" },
  });
}

export async function saveDoctorSchedule(input: {
  doctorId: string;
  schedule: Array<{
    dayOfWeek: number;
    isWorkingDay: boolean;
    startTime: string;
    endTime: string;
    breaks: Array<{ start: string; end: string }>;
    slotDurationMins: number;
    bufferMins: number;
  }>;
}): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.admin.users);

  for (const day of input.schedule) {
    const existing = await db.doctorSchedule.findFirst({
      where: {
        tenantId: ctx.tenantId,
        doctorId: input.doctorId,
        dayOfWeek: day.dayOfWeek,
        branchId: null,
      },
    });

    const data = {
      isWorkingDay: day.isWorkingDay,
      startTime: day.startTime,
      endTime: day.endTime,
      breaks: day.breaks,
      slotDurationMins: day.slotDurationMins,
      bufferMins: day.bufferMins,
      updatedAt: new Date(),
    };

    if (existing) {
      await db.doctorSchedule.update({
        where: { id: existing.id },
        data,
      });
    } else {
      await db.doctorSchedule.create({
        data: {
          id: randomUUID(),
          tenantId: ctx.tenantId,
          doctorId: input.doctorId,
          dayOfWeek: day.dayOfWeek,
          branchId: null,
          ...data,
        },
      });
    }
  }

  revalidatePath("/admin/staff");
}

export async function addScheduleException(input: {
  doctorId: string;
  date: string;
  type: "OFF" | "MODIFIED" | "EXTRA_HOURS";
  startTime?: string;
  endTime?: string;
  reason?: string;
}): Promise<void> {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.admin.users);

  await db.doctorScheduleException.upsert({
    where: {
      tenantId_doctorId_date: {
        tenantId: ctx.tenantId,
        doctorId: input.doctorId,
        date: input.date,
      },
    },
    create: {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      doctorId: input.doctorId,
      date: input.date,
      type: input.type,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      reason: input.reason ?? null,
      allDay: input.type === "OFF",
    },
    update: {
      type: input.type,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      reason: input.reason ?? null,
      allDay: input.type === "OFF",
    },
  });

  revalidatePath("/appointments");
}

async function getPatientName(
  tenantId: string,
  patientId: string,
): Promise<string> {
  const patient = await db.patient.findFirst({
    where: { id: patientId, tenantId },
    select: { firstName: true, lastName: true },
  });
  return patient
    ? `${patient.firstName} ${patient.lastName}`
    : "Patient";
}
