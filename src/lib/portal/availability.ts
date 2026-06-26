import { db } from "@/lib/db";

export type TimeSlot = {
  time: string;
  available: boolean;
  doctorId?: string;
  doctorName?: string;
};

export type DayAvailability = {
  date: string;
  slots: TimeSlot[];
  hasAvailability: boolean;
};

export async function getAvailableSlots(input: {
  tenantId: string;
  date: string;
  durationMins: number;
  doctorId?: string;
  branchId?: string;
  bufferMins?: number;
}): Promise<TimeSlot[]> {
  const { tenantId, date, durationMins, bufferMins = 15 } = input;
  const slotDuration = durationMins + bufferMins;

  const workStart = 9;
  const workEnd = 18;

  const slots: TimeSlot[] = [];
  for (let hour = workStart; hour < workEnd; hour++) {
    for (let min = 0; min < 60; min += slotDuration) {
      if (hour * 60 + min + durationMins > workEnd * 60) break;
      slots.push({
        time: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
        available: true,
      });
    }
  }

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const existing = await db.appointment.findMany({
    where: {
      tenantId,
      startTime: { gte: startOfDay, lte: endOfDay },
      status: { notIn: ["CANCELED", "NO_SHOW"] },
      ...(input.doctorId ? { doctorId: input.doctorId } : {}),
    },
    select: { startTime: true, endTime: true },
  });

  const pendingBookings = await db.bookingRequest.findMany({
    where: {
      tenantId,
      requestedDate: date,
      status: { in: ["PENDING", "CONFIRMED"] },
      ...(input.doctorId ? { doctorId: input.doctorId } : {}),
    },
    select: { requestedTime: true, durationMins: true },
  });

  return slots.map((slot) => {
    const [h, m] = slot.time.split(":").map(Number);
    const slotStart = h * 60 + m;
    const slotEnd = slotStart + durationMins;

    const conflict = existing.some((apt) => {
      const aptStart =
        apt.startTime.getHours() * 60 + apt.startTime.getMinutes();
      const aptEnd = apt.endTime.getHours() * 60 + apt.endTime.getMinutes();
      return slotStart < aptEnd && slotEnd > aptStart;
    });

    const bookingConflict = pendingBookings.some((b) => {
      const [bh, bm] = b.requestedTime.split(":").map(Number);
      const bStart = bh * 60 + bm;
      const bEnd = bStart + b.durationMins;
      return slotStart < bEnd && slotEnd > bStart;
    });

    return { ...slot, available: !conflict && !bookingConflict };
  });
}

export async function getAvailableDates(input: {
  tenantId: string;
  durationMins: number;
  doctorId?: string;
  leadHours: number;
  maxDays: number;
  bufferMins?: number;
}): Promise<string[]> {
  const dates: string[] = [];
  const start = new Date();
  start.setHours(start.getHours() + input.leadHours);

  for (let i = 0; i < input.maxDays; i++) {
    const date = new Date(start);
    date.setDate(date.getDate() + i);

    if (date.getDay() === 5) continue;

    const dateStr = date.toISOString().split("T")[0];
    const slots = await getAvailableSlots({
      tenantId: input.tenantId,
      date: dateStr,
      durationMins: input.durationMins,
      doctorId: input.doctorId,
      bufferMins: input.bufferMins,
    });

    if (slots.some((s) => s.available)) {
      dates.push(dateStr);
    }
  }

  return dates.slice(0, 30);
}
