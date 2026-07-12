import { db } from "@/lib/db";
import {
  clinicMinutesSinceMidnight,
  getClinicDayBounds,
  getClinicNowParts,
  resolveClinicTimezone,
} from "@/lib/datetime/clinic-timezone";

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
  hasScheduleConfigured: boolean;
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

/** Branch-specific schedule first, then tenant-wide (branchId null) fallback. */
async function findDoctorSchedule(input: {
  tenantId: string;
  doctorId: string;
  dayOfWeek: number;
  branchId?: string;
}) {
  if (input.branchId) {
    const branchSpecific = await db.doctorSchedule.findFirst({
      where: {
        tenantId: input.tenantId,
        doctorId: input.doctorId,
        dayOfWeek: input.dayOfWeek,
        branchId: input.branchId,
      },
    });
    if (branchSpecific) return branchSpecific;
  }

  return db.doctorSchedule.findFirst({
    where: {
      tenantId: input.tenantId,
      doctorId: input.doctorId,
      dayOfWeek: input.dayOfWeek,
      branchId: null,
    },
  });
}

export async function getDoctorSlots(input: {
  tenantId: string;
  doctorId: string;
  date: string;
  durationMins: number;
  branchId?: string;
}): Promise<TimeSlot[]> {
  const { tenantId, doctorId, date, durationMins } = input;

  const tenant = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { timezone: true },
  });
  const clinicTz = resolveClinicTimezone(tenant?.timezone);

  const dayOfWeek = new Date(`${date}T12:00:00`).getDay();

  const exception = await db.doctorScheduleException.findFirst({
    where: { tenantId, doctorId, date },
  });

  if (exception?.type === "OFF") {
    return [];
  }

  const schedule = await findDoctorSchedule({
    tenantId,
    doctorId,
    dayOfWeek,
    branchId: input.branchId,
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

  const { start: dateStart, end: dateEnd } = getClinicDayBounds(date, clinicTz);

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

  const { dateStr: clinicToday, minutesSinceMidnight: nowMins } =
    getClinicNowParts(clinicTz);
  const isToday = date === clinicToday;
  const pastSlotCutoff = nowMins + 30;

  return allSlots.map((slot) => {
    const slotStartMins = toMinutes(slot.time);
    const slotEndMins = toMinutes(slot.endTime);

    if (isToday && slotStartMins <= pastSlotCutoff) {
      return { ...slot, available: false };
    }

    const apptConflict = existingAppts.some((appt) => {
      const aStart = clinicMinutesSinceMidnight(appt.startTime, clinicTz);
      const aEnd = clinicMinutesSinceMidnight(appt.endTime, clinicTz);
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

  const configuredDoctorIds = new Set(
    (
      await db.doctorSchedule.groupBy({
        by: ["doctorId"],
        where: {
          tenantId,
          doctorId: { in: doctors.map((d) => d.id) },
        },
      })
    ).map((row) => row.doctorId),
  );

  for (const doctor of doctors) {
    const hasScheduleConfigured = configuredDoctorIds.has(doctor.id);
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
      hasScheduleConfigured,
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

export type NextAvailableSlot = {
  doctorId: string;
  doctorName: string;
  calendarColor: string;
  specialization: string | null;
  time: string;
  date: string;
  chairId: string | null;
  chairName: string | null;
};

/**
 * Cross-doctor "any doctor, soonest" lookup.
 * Does not replace per-doctor booking — additional entry point only.
 * Never displaces existing bookings; only returns free slots.
 */
export async function getNextAvailableSlotAnyDoctor(
  tenantId: string,
  date: string,
  durationMins: number,
  branchId?: string,
): Promise<NextAvailableSlot | null> {
  const availability = await getAllDoctorAvailability({
    tenantId,
    date,
    durationMins,
    branchId,
  });

  const withSlot = availability.filter(
    (d) =>
      d.hasScheduleConfigured &&
      d.isWorkingToday &&
      d.nextSlot != null &&
      d.availableSlots > 0,
  );

  if (withSlot.length === 0) return null;

  withSlot.sort((a, b) => {
    const aMins = toMinutes(a.nextSlot!);
    const bMins = toMinutes(b.nextSlot!);
    if (aMins !== bMins) return aMins - bMins;
    return a.doctorName.localeCompare(b.doctorName);
  });

  const best = withSlot[0]!;

  // Prefer an active chair that is not currently IN_CHAIR (additive only).
  const busyChairIds = (
    await db.appointment.findMany({
      where: {
        tenantId,
        status: "IN_CHAIR",
        deletedAt: null,
        chairId: { not: null },
      },
      select: { chairId: true },
    })
  )
    .map((a) => a.chairId)
    .filter((id): id is string => Boolean(id));

  const freeChair = await db.chair.findFirst({
    where: {
      tenantId,
      status: "ACTIVE",
      isActive: true,
      ...(busyChairIds.length > 0 ? { id: { notIn: busyChairIds } } : {}),
      ...(branchId ? { branchId } : {}),
    },
    select: { id: true, name: true },
    orderBy: { number: "asc" },
  });

  return {
    doctorId: best.doctorId,
    doctorName: best.doctorName,
    calendarColor: best.calendarColor,
    specialization: best.specialization,
    time: best.nextSlot!,
    date,
    chairId: freeChair?.id ?? null,
    chairName: freeChair?.name ?? null,
  };
}

export type DoctorNowStatus = {
  doctorId: string;
  doctorRecordId: string | null;
  doctorName: string;
  calendarColor: string;
  specialization: string | null;
  /** FREE_NOW | IN_CHAIR | HAS_WAITING */
  status: "FREE_NOW" | "IN_CHAIR" | "HAS_WAITING";
  currentPatientName: string | null;
  currentEndTime: Date | null;
  isWorkingToday: boolean;
};

/** Doctors working today with live in-chair / free-now status for emergency assignment. */
export async function getDoctorsWithNowStatus(input: {
  tenantId: string;
  date: string;
  branchId?: string;
}): Promise<DoctorNowStatus[]> {
  const availability = await getAllDoctorAvailability({
    tenantId: input.tenantId,
    date: input.date,
    durationMins: 30,
    branchId: input.branchId,
  });

  const results: DoctorNowStatus[] = [];

  for (const doc of availability) {
    if (!doc.hasScheduleConfigured || !doc.isWorkingToday) continue;

    const doctorRecordId = await resolveDoctorRecordId(doc.doctorId, input.tenantId);

    let status: DoctorNowStatus["status"] = "FREE_NOW";
    let currentPatientName: string | null = null;
    let currentEndTime: Date | null = null;

    if (doctorRecordId) {
      const inChair = await db.appointment.findFirst({
        where: {
          tenantId: input.tenantId,
          doctorId: doctorRecordId,
          status: "IN_CHAIR",
          deletedAt: null,
        },
        include: {
          patient: { select: { firstName: true, lastName: true } },
        },
        orderBy: { startTime: "desc" },
      });

      if (inChair) {
        status = "IN_CHAIR";
        currentPatientName = inChair.patient
          ? `${inChair.patient.firstName} ${inChair.patient.lastName}`
          : null;
        currentEndTime = inChair.endTime;
      } else {
        const waiting = await db.appointment.findFirst({
          where: {
            tenantId: input.tenantId,
            doctorId: doctorRecordId,
            status: "ARRIVED",
            deletedAt: null,
          },
          select: { id: true },
        });
        if (waiting) status = "HAS_WAITING";
      }
    }

    results.push({
      doctorId: doc.doctorId,
      doctorRecordId,
      doctorName: doc.doctorName,
      calendarColor: doc.calendarColor,
      specialization: doc.specialization,
      status,
      currentPatientName,
      currentEndTime,
      isWorkingToday: true,
    });
  }

  const order = { FREE_NOW: 0, HAS_WAITING: 1, IN_CHAIR: 2 } as const;
  return results.sort((a, b) => order[a.status] - order[b.status]);
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
