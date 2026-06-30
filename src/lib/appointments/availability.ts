import { db } from "@/lib/db";

export type TimeSlot = {
  time: string;
  endTime: string;
  available: boolean;
  doctorId: string;
};

export type DoctorAvailability = {
  doctorId: string;
  doctorName: string;
  calendarColor: string;
  role: string;
  specialization: string | null;
  isWorkingToday: boolean;
  totalSlots: number;
  availableSlots: number;
  nextSlot: string | null;
};

type ScheduleBreak = {
  start: string;
  end: string;
};

/** Resolve StaffMember id or Doctor id to Doctor record id for appointment queries. */
async function resolveDoctorRecordId(
  doctorId: string,
  tenantId: string,
): Promise<string | null> {
  const byDoctorId = await db.doctor.findFirst({
    where: { id: doctorId, tenantId },
    select: { id: true },
  });
  if (byDoctorId) return byDoctorId.id;

  const byUserId = await db.doctor.findFirst({
    where: { userId: doctorId, tenantId },
    select: { id: true },
  });
  return byUserId?.id ?? null;
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function fromMinutes(mins: number): string {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export async function getDoctorSlots(input: {
  tenantId: string;
  doctorId: string;
  date: string;
  durationMins: number;
  branchId?: string;
}): Promise<TimeSlot[]> {
  const { tenantId, doctorId, date, durationMins } = input;

  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();

  const exception = await db.doctorScheduleException.findFirst({
    where: { tenantId, doctorId, date },
  });

  if (exception?.type === "OFF") {
    return [];
  }

  const schedule = await db.doctorSchedule.findFirst({
    where: {
      tenantId,
      doctorId,
      dayOfWeek,
      ...(input.branchId ? { branchId: input.branchId } : {}),
    },
  });

  if (!schedule || !schedule.isWorkingDay) {
    return [];
  }

  const startTime =
    exception?.type === "MODIFIED" && exception.startTime
      ? exception.startTime
      : schedule.startTime;

  const endTime =
    exception?.type === "MODIFIED" && exception.endTime
      ? exception.endTime
      : schedule.endTime;

  const bufferMins = schedule.bufferMins;
  const slotDurationMins = durationMins;
  const stepMins = slotDurationMins + bufferMins;

  const breaks = (schedule.breaks as ScheduleBreak[]) ?? [];

  const allSlots: TimeSlot[] = [];
  const workStart = toMinutes(startTime);
  const workEnd = toMinutes(endTime);
  let current = workStart;

  while (current + slotDurationMins <= workEnd) {
    const slotEnd = current + slotDurationMins;

    const inBreak = breaks.some((b) => {
      const bStart = toMinutes(b.start);
      const bEnd = toMinutes(b.end);
      return current < bEnd && slotEnd > bStart;
    });

    if (!inBreak) {
      allSlots.push({
        time: fromMinutes(current),
        endTime: fromMinutes(slotEnd),
        available: true,
        doctorId,
      });
    }

    current += stepMins;
  }

  const dateStart = new Date(`${date}T00:00:00.000Z`);
  const dateEnd = new Date(`${date}T23:59:59.999Z`);

  const appointmentDoctorId = await resolveDoctorRecordId(doctorId, tenantId);

  const existingAppts = appointmentDoctorId
    ? await db.appointment.findMany({
        where: {
          tenantId,
          doctorId: appointmentDoctorId,
          startTime: { gte: dateStart, lte: dateEnd },
          status: { notIn: ["CANCELED", "NO_SHOW"] },
          deletedAt: null,
        },
        select: { startTime: true, endTime: true },
      })
    : [];

  const pendingBookings = await db.bookingRequest.findMany({
    where: {
      tenantId,
      requestedDate: date,
      status: { in: ["PENDING", "CONFIRMED"] },
      ...(appointmentDoctorId
        ? { doctorId: appointmentDoctorId }
        : { doctorId }),
    },
    select: { requestedTime: true, durationMins: true },
  });

  const now = new Date();
  const isToday = date === now.toISOString().split("T")[0];
  const nowMins = now.getHours() * 60 + now.getMinutes() + 30;

  return allSlots.map((slot) => {
    const slotStartMins = toMinutes(slot.time);
    const slotEndMins = toMinutes(slot.endTime);

    if (isToday && slotStartMins <= nowMins) {
      return { ...slot, available: false };
    }

    const apptConflict = existingAppts.some((appt) => {
      const aStart = appt.startTime.getHours() * 60 + appt.startTime.getMinutes();
      const aEnd = appt.endTime.getHours() * 60 + appt.endTime.getMinutes();
      return slotStartMins < aEnd && slotEndMins > aStart;
    });

    const bookingConflict = pendingBookings.some((b) => {
      const [bh, bm] = b.requestedTime.split(":").map(Number);
      const bStart = bh * 60 + bm;
      const bEnd = bStart + b.durationMins;
      return slotStartMins < bEnd && slotEndMins > bStart;
    });

    return {
      ...slot,
      available: !apptConflict && !bookingConflict,
    };
  });
}

export async function getAllDoctorAvailability(input: {
  tenantId: string;
  date: string;
  durationMins: number;
  branchId?: string;
}): Promise<DoctorAvailability[]> {
  const { tenantId, date, durationMins } = input;

  const doctors = await db.staffMember.findMany({
    where: {
      tenantId,
      role: { in: ["DOCTOR", "DENTIST", "HYGIENIST"] },
      deletedAt: null,
      isActive: true,
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      role: true,
      doctor: {
        select: {
          color: true,
          specialty: true,
        },
      },
    },
  });

  const results: DoctorAvailability[] = [];

  for (const doctor of doctors) {
    const slots = await getDoctorSlots({
      tenantId,
      doctorId: doctor.id,
      date,
      durationMins,
      branchId: input.branchId,
    });

    const availableSlots = slots.filter((s) => s.available);
    const isWorkingToday = slots.length > 0;

    results.push({
      doctorId: doctor.id,
      doctorName: `Dr. ${doctor.firstName ?? ""} ${doctor.lastName ?? ""}`.trim(),
      calendarColor: doctor.doctor?.color ?? "#0ea5e9",
      role: doctor.role,
      specialization: doctor.doctor?.specialty ?? null,
      isWorkingToday,
      totalSlots: slots.length,
      availableSlots: availableSlots.length,
      nextSlot: availableSlots[0]?.time ?? null,
    });
  }

  return results.sort((a, b) => {
    if (a.isWorkingToday !== b.isWorkingToday) {
      return a.isWorkingToday ? -1 : 1;
    }
    return b.availableSlots - a.availableSlots;
  });
}

export async function getDoctorAvailableDates(input: {
  tenantId: string;
  doctorId: string;
  durationMins: number;
  fromDate?: string;
  maxDays?: number;
  branchId?: string;
}): Promise<string[]> {
  const maxDays = input.maxDays ?? 60;
  const dates: string[] = [];

  const start = input.fromDate ? new Date(input.fromDate) : new Date();

  for (let i = 0; i < maxDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];

    const slots = await getDoctorSlots({
      tenantId: input.tenantId,
      doctorId: input.doctorId,
      date: dateStr,
      durationMins: input.durationMins,
      branchId: input.branchId,
    });

    if (slots.some((s) => s.available)) {
      dates.push(dateStr);
    }
  }

  return dates;
}
