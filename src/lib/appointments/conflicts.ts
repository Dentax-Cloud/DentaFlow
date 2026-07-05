import { db } from "@/lib/db";
import { AppointmentStatus } from "@prisma/client";

const ACTIVE_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "ARRIVED",
  "IN_CHAIR",
  "COMPLETED",
];

export type SchedulingConflict = "chair" | "doctor" | "invalid_range";

export async function findSchedulingConflicts(
  tenantId: string,
  params: {
    startTime: Date;
    endTime: Date;
    chairId?: string | null;
    doctorId?: string | null;
    excludeAppointmentId?: string;
  },
): Promise<SchedulingConflict[]> {
  if (params.endTime <= params.startTime) return ["invalid_range"];

  const overlap = {
    tenantId,
    deletedAt: null,
    status: { in: ACTIVE_STATUSES },
    ...(params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {}),
    startTime: { lt: params.endTime },
    endTime: { gt: params.startTime },
  };

  const conflicts: SchedulingConflict[] = [];

  if (params.chairId) {
    const chairBusy = await db.appointment.findFirst({
      where: { ...overlap, chairId: params.chairId },
      select: { id: true },
    });
    if (chairBusy) conflicts.push("chair");
  }

  if (params.doctorId) {
    const doctorBusy = await db.appointment.findFirst({
      where: { ...overlap, doctorId: params.doctorId },
      select: { id: true },
    });
    if (doctorBusy) conflicts.push("doctor");
  }

  return conflicts;
}

export function conflictMessage(conflicts: SchedulingConflict[]): string {
  if (conflicts.includes("invalid_range")) return "End time must be after start time.";
  if (conflicts.includes("chair") && conflicts.includes("doctor")) {
    return "This chair and doctor are already booked for that time.";
  }
  if (conflicts.includes("chair")) return "This chair is already booked for that time.";
  if (conflicts.includes("doctor")) return "This doctor is already booked for that time.";
  return "Scheduling conflict detected.";
}
