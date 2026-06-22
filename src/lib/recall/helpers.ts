import { db } from "@/lib/db";
import { tenantWhere } from "@/lib/tenant/scoped";
import {
  calculateChurnRisk,
  calculateNoShowRisk,
  toRiskLevel,
} from "@/lib/ai/calculate-risk";

export async function refreshPatientRiskScores(tenantId: string, patientId: string) {
  const patient = await db.patient.findFirst({
    where: tenantWhere(tenantId, { id: patientId, deletedAt: null }),
    select: { id: true, lastVisitAt: true, noShowCount: true },
  });
  if (!patient) return;

  const [appointmentCount, nextRecall] = await Promise.all([
    db.appointment.count({
      where: { tenantId, patientId, deletedAt: null },
    }),
    db.recall.findFirst({
      where: {
        tenantId,
        patientId,
        status: "PENDING",
        completedAt: null,
      },
      orderBy: { dueDate: "asc" },
      select: { dueDate: true },
    }),
  ]);

  const noShowBand = calculateNoShowRisk({
    appointmentCount,
    noShowCount: patient.noShowCount,
    lastVisitDate: patient.lastVisitAt,
  });
  const churnBand = calculateChurnRisk({
    lastVisitDate: patient.lastVisitAt,
    recallDueDate: nextRecall?.dueDate ?? null,
  });

  await db.patient.update({
    where: { id: patient.id },
    data: {
      noShowRisk: toRiskLevel(noShowBand),
      churnRisk: toRiskLevel(churnBand),
    },
  });
}

export type RecallSettings = {
  defaultIntervalMonths: number;
  autoCreateOnComplete: boolean;
  reminderLeadDays: number;
};

export const DEFAULT_RECALL_SETTINGS: RecallSettings = {
  defaultIntervalMonths: 6,
  autoCreateOnComplete: true,
  reminderLeadDays: 7,
};

export function parseRecallSettings(metadata: unknown): RecallSettings {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return DEFAULT_RECALL_SETTINGS;
  }
  const raw = (metadata as Record<string, unknown>).recallSettings;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return DEFAULT_RECALL_SETTINGS;
  }
  const s = raw as Record<string, unknown>;
  return {
    defaultIntervalMonths:
      typeof s.defaultIntervalMonths === "number" ? s.defaultIntervalMonths : 6,
    autoCreateOnComplete:
      typeof s.autoCreateOnComplete === "boolean" ? s.autoCreateOnComplete : true,
    reminderLeadDays: typeof s.reminderLeadDays === "number" ? s.reminderLeadDays : 7,
  };
}

export async function maybeCreateRecallAfterAppointment(params: {
  tenantId: string;
  patientId: string;
}) {
  const tenant = await db.tenant.findUnique({
    where: { id: params.tenantId },
    select: { metadata: true },
  });
  const settings = parseRecallSettings(tenant?.metadata);
  if (!settings.autoCreateOnComplete) return;

  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + settings.defaultIntervalMonths);

  const existing = await db.recall.findFirst({
    where: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      status: "PENDING",
      completedAt: null,
      dueDate: { gte: new Date() },
    },
  });
  if (existing) return;

  await db.recall.create({
    data: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      type: "ROUTINE",
      dueDate,
      status: "PENDING",
    },
  });
}
