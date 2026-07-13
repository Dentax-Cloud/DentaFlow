import { db } from "@/lib/db";
import { autoCloseChairsideSessionsForAppointment } from "@/lib/clinical/chairside-lifecycle";
import { runPostDerivedVisitIntelligence } from "@/lib/encounter/post-visit-intelligence";

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
 * Does NOT call completeVisit() — uses encounter intelligence (estimate + plan
 * suggestions) instead of chairside finalize / recall side effects from Phase 6.
 *
 * Does close ACTIVE ChairsideSession(s) for the appointment with allowInvoice:false
 * so ProcedureLine remains the sole billing path (no dual-path CHAIRSIDE invoice).
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
    select: {
      id: true,
      status: true,
      patientId: true,
      patient: {
        select: { id: true, firstName: true, lastName: true },
      },
      tenant: { select: { countryCode: true } },
    },
  });
  if (!appointment) {
    return { applied: false, derivation };
  }

  let applied = false;

  if (appointment.status !== "COMPLETED") {
    await db.appointment.update({
      where: { id: appointmentId },
      data: { status: "COMPLETED" },
    });
    applied = true;

    if (appointment.patientId && appointment.patient) {
      await runPostDerivedVisitIntelligence({
        tenantId,
        appointmentId,
        patientId: appointment.patientId,
        patientName: `${appointment.patient.firstName} ${appointment.patient.lastName}`.trim(),
        countryCode: appointment.tenant.countryCode,
      }).catch(() => null);
    }
  }

  // Invoice-free session close — ProcedureLine owns billing on this path.
  // Also heals stale ACTIVE sessions if the appointment was already COMPLETED.
  await autoCloseChairsideSessionsForAppointment({
    tenantId,
    appointmentId,
    appointmentStatus: "COMPLETED",
    allowInvoice: false,
  }).catch(() => null);

  // Guarantee banner clear: if finalize aborted (e.g. chart validation),
  // still leave no ACTIVE sessions for this completed visit.
  await db.chairsideSession.updateMany({
    where: {
      tenantId,
      appointmentId,
      status: "ACTIVE",
    },
    data: {
      status: "FINALIZED",
      finalizedAt: new Date(),
      closedReason: "auto_closed_appointment_completed",
    },
  });

  return { applied, derivation };
}
