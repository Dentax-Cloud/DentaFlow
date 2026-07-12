import { CampaignChannel, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { encounterWorkspacePath } from "@/lib/clinical/encounter-url";
import { createNotification, notifyMultiple } from "@/lib/notifications/notification-service";
import { isPrismaUniqueViolation, workerClaimLogId } from "@/worker/claim";
import {
  hoursOpen,
  STALLED_LINE_ESCALATE_THRESHOLD_MS,
  STALLED_LINE_WARN_THRESHOLD_MS,
} from "@/lib/procedure-lines/stalled-line-thresholds";

async function claimStalledLineAlert(params: {
  claimId: string;
  tenantId: string;
  patientId?: string | null;
  subject: string;
}): Promise<boolean> {
  try {
    await db.communicationLog.create({
      data: {
        id: params.claimId,
        tenantId: params.tenantId,
        patientId: params.patientId ?? null,
        channel: CampaignChannel.EMAIL,
        subject: params.subject,
        body: "pending",
        status: "pending",
      },
    });
    return true;
  } catch (err) {
    if (isPrismaUniqueViolation(err)) return false;
    throw err;
  }
}

async function markStalledLineAlertSent(claimId: string, body: string) {
  await db.communicationLog.update({
    where: { id: claimId },
    data: { body, status: "sent" },
  });
}

function ownerDisplayName(owner: {
  firstName: string | null;
  lastName: string | null;
} | null): string {
  if (!owner) return "Unassigned";
  const name = `${owner.firstName ?? ""} ${owner.lastName ?? ""}`.trim();
  return name || "Staff";
}

function procedureLabel(line: {
  procedureName: string | null;
  procedureCode: string | null;
}): string {
  return line.procedureName ?? line.procedureCode ?? "procedure";
}

/**
 * Warn owners at WARN threshold; escalate to ADMIN/OWNER at ESCALATE threshold.
 * Idempotent via CommunicationLog claim ids (same pattern as appointment reminders).
 */
export async function processStalledProcedureLineEscalation(
  now: Date = new Date(),
): Promise<{ warned: number; escalated: number }> {
  const warnCutoff = new Date(now.getTime() - STALLED_LINE_WARN_THRESHOLD_MS);
  const escalateCutoff = new Date(now.getTime() - STALLED_LINE_ESCALATE_THRESHOLD_MS);

  const openLines = await db.procedureLine.findMany({
    where: {
      status: "IN_PROGRESS",
      createdAt: { lte: warnCutoff },
    },
    include: {
      appointment: {
        include: {
          patient: { select: { id: true, firstName: true, lastName: true } },
        },
      },
    },
  });

  let warned = 0;
  let escalated = 0;

  for (const line of openLines) {
    const patient = line.appointment.patient;
    const patientName = patient
      ? `${patient.firstName} ${patient.lastName}`
      : "Patient";
    const openHours = Math.round(hoursOpen(line.createdAt, now) * 10) / 10;
    const procedure = procedureLabel(line);
    const visitBoardLink = `/clinical/visit-board?appointmentId=${line.appointmentId}`;
    const chairsideLink = encounterWorkspacePath(line.appointmentId);

    if (line.createdAt <= escalateCutoff) {
      const claimId = workerClaimLogId("stalled_line_escalate", line.id);
      const claimed = await claimStalledLineAlert({
        claimId,
        tenantId: line.tenantId,
        patientId: patient?.id ?? null,
        subject: `dentaflow:stalled_line_escalate:${line.id}`,
      });
      if (!claimed) continue;

      const owner = line.ownerId
        ? await db.staffMember.findFirst({
            where: { id: line.ownerId, tenantId: line.tenantId },
            select: { firstName: true, lastName: true },
          })
        : null;
      const ownerName = ownerDisplayName(owner);

      const admins = await db.staffMember.findMany({
        where: {
          tenantId: line.tenantId,
          isActive: true,
          deletedAt: null,
          role: { in: [UserRole.ADMIN, UserRole.OWNER] },
        },
        select: { id: true, email: true },
      });

      await notifyMultiple(admins, {
        tenantId: line.tenantId,
        type: "STALLED_PROCEDURE_LINE_ESCALATED",
        title: "Stalled procedure line",
        body: `${patientName}'s visit has a stalled line — ${ownerName} hasn't closed ${procedure} in ${openHours} hours.`,
        link: visitBoardLink,
        entityType: "ProcedureLine",
        entityId: line.id,
        channel: "IN_APP",
      });

      if (line.ownerId) {
        await createNotification({
          tenantId: line.tenantId,
          recipientId: line.ownerId,
          type: "STALLED_PROCEDURE_LINE_WARN",
          title: "Procedure line still open",
          body: `Your procedure line for ${patientName} (${procedure}) has been open for ${openHours} hours. Please close it when complete.`,
          link: chairsideLink,
          entityType: "ProcedureLine",
          entityId: line.id,
          channel: "IN_APP",
        }).catch(() => null);
      }

      await markStalledLineAlertSent(
        claimId,
        `Escalated stalled line ${line.id} (${openHours}h)`,
      );
      escalated++;
      continue;
    }

    const warnClaimId = workerClaimLogId("stalled_line_warn", line.id);
    const warnClaimed = await claimStalledLineAlert({
      claimId: warnClaimId,
      tenantId: line.tenantId,
      patientId: patient?.id ?? null,
      subject: `dentaflow:stalled_line_warn:${line.id}`,
    });
    if (!warnClaimed) continue;

    if (line.ownerId) {
      await createNotification({
        tenantId: line.tenantId,
        recipientId: line.ownerId,
        type: "STALLED_PROCEDURE_LINE_WARN",
        title: "Procedure line still open",
        body: `Your procedure line for ${patientName} (${procedure}) has been open for ${openHours} hours. Please close it when complete.`,
        link: chairsideLink,
        entityType: "ProcedureLine",
        entityId: line.id,
        channel: "IN_APP",
      });
    }

    await markStalledLineAlertSent(
      warnClaimId,
      `Warned owner for stalled line ${line.id} (${openHours}h)`,
    );
    warned++;
  }

  return { warned, escalated };
}
