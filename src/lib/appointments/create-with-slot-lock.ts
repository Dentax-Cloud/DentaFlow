import { db } from "@/lib/db";
import { Prisma, type AppointmentStatus } from "@prisma/client";
import {
  conflictMessage,
  type SchedulingConflict,
} from "@/lib/appointments/conflicts";

const LOCK_STATUSES: AppointmentStatus[] = [
  "SCHEDULED",
  "CONFIRMED",
  "ARRIVED",
  "IN_CHAIR",
  "COMPLETED",
  "INVOICED",
];

export type BookSlotInput = {
  tenantId: string;
  patientId: string;
  doctorId: string | null;
  chairId?: string | null;
  branchId?: string | null;
  startTime: Date;
  endTime: Date;
  title: string;
  status?: AppointmentStatus;
  type?: string | null;
  notes?: string | null;
  procedureId?: string | null;
  bookedById?: string | null;
  bookedVia?: string | null;
  preAuthStatus?: string | null;
  appointmentRef?: string | null;
  priority?: string | null;
  priorityReason?: string | null;
  providerId?: string | null;
  id?: string;
};

class SlotConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SlotConflictError";
  }
}

type TxClient = Prisma.TransactionClient;

async function findSchedulingConflictsInTx(
  tx: TxClient,
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
    status: { in: LOCK_STATUSES },
    ...(params.excludeAppointmentId ? { id: { not: params.excludeAppointmentId } } : {}),
    startTime: { lt: params.endTime },
    endTime: { gt: params.startTime },
  };

  const conflicts: SchedulingConflict[] = [];

  if (params.chairId) {
    const chairBusy = await tx.appointment.findFirst({
      where: { ...overlap, chairId: params.chairId },
      select: { id: true },
    });
    if (chairBusy) conflicts.push("chair");
  }

  if (params.doctorId) {
    const doctorBusy = await tx.appointment.findFirst({
      where: { ...overlap, doctorId: params.doctorId },
      select: { id: true },
    });
    if (doctorBusy) conflicts.push("doctor");
  }

  return conflicts;
}

/**
 * Atomically conflict-check (doctor + chair) and create an appointment.
 * Locks overlapping appointment rows with SELECT … FOR UPDATE so concurrent
 * bookers cannot both succeed for the same doctor/chair slot.
 */
export async function createAppointmentWithSlotLock(
  input: BookSlotInput,
): Promise<{ success: true; appointmentId: string } | { success: false; error: string }> {
  try {
    const appointmentId = await db.$transaction(async (tx) => {
      // Lock all overlapping active appointments in this window (tenant-scoped).
      await tx.$queryRaw`
        SELECT id FROM "Appointment"
        WHERE "tenantId" = ${input.tenantId}
          AND "deletedAt" IS NULL
          AND status IN ('SCHEDULED','CONFIRMED','ARRIVED','IN_CHAIR','COMPLETED','INVOICED')
          AND "startTime" < ${input.endTime}
          AND "endTime" > ${input.startTime}
        FOR UPDATE
      `;

      const conflicts = await findSchedulingConflictsInTx(tx, input.tenantId, {
        startTime: input.startTime,
        endTime: input.endTime,
        doctorId: input.doctorId,
        chairId: input.chairId ?? null,
      });

      if (conflicts.length > 0) {
        throw new SlotConflictError(conflictMessage(conflicts));
      }

      const created = await tx.appointment.create({
        data: {
          id: input.id,
          tenantId: input.tenantId,
          patientId: input.patientId,
          doctorId: input.doctorId,
          chairId: input.chairId ?? null,
          branchId: input.branchId ?? null,
          startTime: input.startTime,
          endTime: input.endTime,
          title: input.title,
          status: input.status ?? "SCHEDULED",
          type: input.type ?? null,
          notes: input.notes ?? null,
          procedureId: input.procedureId ?? null,
          bookedById: input.bookedById ?? null,
          bookedVia: input.bookedVia ?? null,
          preAuthStatus: input.preAuthStatus ?? "NOT_REQUIRED",
          appointmentRef: input.appointmentRef ?? null,
          priority: input.priority ?? "ROUTINE",
          priorityReason: input.priorityReason ?? null,
          providerId: input.providerId ?? null,
        },
        select: { id: true },
      });

      return created.id;
    });

    return { success: true, appointmentId };
  } catch (err) {
    if (err instanceof SlotConflictError) {
      return { success: false, error: err.message };
    }
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code?: string }).code === "P2034"
    ) {
      return {
        success: false,
        error: "This time slot was just booked by someone else. Please select another time.",
      };
    }
    throw err;
  }
}
