import { db } from "@/lib/db";
import { getDoctorSlots } from "@/lib/appointments/availability";

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

async function getStaffMemberIdForDoctor(
  tenantId: string,
  doctorId: string,
): Promise<string | null> {
  const byStaff = await db.staffMember.findFirst({
    where: {
      id: doctorId,
      tenantId,
      role: { in: ["DOCTOR", "DENTIST", "HYGIENIST"] },
      deletedAt: null,
    },
    select: { id: true },
  });
  if (byStaff) return byStaff.id;

  const byDoctor = await db.doctor.findFirst({
    where: { id: doctorId, tenantId },
    select: { userId: true },
  });
  return byDoctor?.userId ?? null;
}

export async function getAvailableSlots(input: {
  tenantId: string;
  date: string;
  durationMins: number;
  doctorId?: string;
  branchId?: string;
  bufferMins?: number;
}): Promise<TimeSlot[]> {
  const { tenantId, date, durationMins } = input;

  if (input.doctorId) {
    const staffMemberId = await getStaffMemberIdForDoctor(
      tenantId,
      input.doctorId,
    );
    if (!staffMemberId) return [];

    const slots = await getDoctorSlots({
      tenantId,
      doctorId: staffMemberId,
      date,
      durationMins,
      branchId: input.branchId,
    });

    return slots.map((slot) => ({
      time: slot.time,
      available: slot.available,
      doctorId: input.doctorId,
    }));
  }

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
    },
  });

  const slotMap = new Map<string, TimeSlot>();

  for (const doctor of doctors) {
    const slots = await getDoctorSlots({
      tenantId,
      doctorId: doctor.id,
      date,
      durationMins,
      branchId: input.branchId,
    });

    const doctorName =
      `Dr. ${doctor.firstName ?? ""} ${doctor.lastName ?? ""}`.trim();

    for (const slot of slots) {
      const existing = slotMap.get(slot.time);
      if (!existing) {
        slotMap.set(slot.time, {
          time: slot.time,
          available: slot.available,
          doctorId: doctor.id,
          doctorName,
        });
      } else if (slot.available && !existing.available) {
        slotMap.set(slot.time, {
          time: slot.time,
          available: true,
          doctorId: doctor.id,
          doctorName,
        });
      }
    }
  }

  return Array.from(slotMap.values()).sort((a, b) =>
    a.time.localeCompare(b.time),
  );
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
