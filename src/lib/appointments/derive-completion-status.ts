import { db } from "@/lib/db";

export type AppointmentCompletionDerivation =
  | { kind: "no-op" }
  | { kind: "pending" }
  | { kind: "eligible" };

const TERMINAL_PROCEDURE_LINE_STATUSES = new Set(["CLOSED", "VOIDED", "LOCKED"]);

/** Pure helper — unit-tested without DB. */
export function deriveCompletionFromProcedureLineStatuses(
  statuses: string[],
): AppointmentCompletionDerivation {
  if (statuses.length === 0) return { kind: "no-op" };
  if (statuses.some((status) => status === "IN_PROGRESS")) return { kind: "pending" };
  if (statuses.every((status) => TERMINAL_PROCEDURE_LINE_STATUSES.has(status))) {
    return { kind: "eligible" };
  }
  return { kind: "pending" };
}

export async function computeAppointmentCompletionStatus(
  tenantId: string,
  appointmentId: string,
): Promise<AppointmentCompletionDerivation> {
  const lines = await db.procedureLine.findMany({
    where: { tenantId, appointmentId },
    select: { status: true },
  });
  return deriveCompletionFromProcedureLineStatuses(lines.map((line) => line.status));
}

/**
 * Isolated status transition when all ProcedureLines are terminal.
 * Does NOT call completeVisit() — patient follow-up side effects are Phase 6.
 */
export async function applyDerivedAppointmentCompletion(
  tenantId: string,
  appointmentId: string,
): Promise<{ applied: boolean; derivation: AppointmentCompletionDerivation }> {
  const derivation = await computeAppointmentCompletionStatus(tenantId, appointmentId);
  if (derivation.kind !== "eligible") {
    return { applied: false, derivation };
  }

  const appointment = await db.appointment.findFirst({
    where: { id: appointmentId, tenantId, deletedAt: null, isBlock: false },
    select: { id: true, status: true },
  });
  if (!appointment || appointment.status === "COMPLETED") {
    return { applied: false, derivation };
  }

  await db.appointment.update({
    where: { id: appointmentId },
    data: { status: "COMPLETED" },
  });

  return { applied: true, derivation };
}
