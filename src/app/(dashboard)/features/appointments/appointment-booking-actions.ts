"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { getDoctorSlots } from "@/lib/appointments/availability";
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
  notes?: string;
  preAuthStatus?: string;
}): Promise<{ success: boolean; appointmentId?: string; error?: string }> {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.appointments.write);

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

  const [y, m, d] = input.date.split("-").map(Number);
  const [h, min] = input.startTime.split(":").map(Number);
  const start = new Date(y, m - 1, d, h, min);
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
  }

  const appointmentId = randomUUID();
  const appointmentRef = await generateAppointmentRef(ctx.tenantId);

  await db.appointment.create({
    data: {
      id: appointmentId,
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      doctorId: doctorRecordId,
      branchId: input.branchId ?? null,
      startTime: start,
      endTime: end,
      title,
      status: "SCHEDULED",
      notes: input.notes ?? null,
      procedureId: input.procedureId ?? null,
      bookedById: ctx.staffMember?.id ?? null,
      bookedVia: "RECEPTION",
      preAuthStatus: input.preAuthStatus ?? "NOT_REQUIRED",
      appointmentRef,
    },
  });

  await notifyAppointmentStatus(
    appointmentId,
    ctx.tenantId,
    "SCHEDULED",
    await getPatientName(ctx.tenantId, input.patientId),
  ).catch(() => null);

  revalidatePath("/appointments");
  return { success: true, appointmentId };
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

  const today = input?.date ?? new Date().toISOString().split("T")[0];
  const [y, m, d] = today.split("-").map(Number);
  const dayStart = new Date(y, m - 1, d, 0, 0, 0);
  const dayEnd = new Date(y, m - 1, d, 23, 59, 59);

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
