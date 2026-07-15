import { AuditAction, Prisma, TreatmentPlanStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/actions/safe-action";
import {
  createEncounterAudited,
  createProviderPresenceAudited,
  updateEncounterAudited,
} from "./repository";
import {
  assertTransition,
  canTransition,
  INTERRUPT_OUTCOMES,
  type InterruptOutcome,
  isEncounterStatus,
} from "./state-machine";
import type { EncounterStatus } from "./types";

export type CreateEncounterFromAppointmentParams = {
  tenantId: string;
  appointmentId: string;
  userId?: string;
  staffMemberId?: string | null;
  /** Explicit walk-in: force null plan even if one exists. */
  walkIn?: boolean;
  originRecallId?: string | null;
};

async function resolveTreatmentPlanId(params: {
  tenantId: string;
  patientId: string;
  appointmentId: string;
  walkIn?: boolean;
}): Promise<string | null> {
  if (params.walkIn) return null;

  const itemLinked = await db.treatmentItem.findFirst({
    where: {
      tenantId: params.tenantId,
      linkedAppointmentId: params.appointmentId,
      treatmentPlan: {
        deletedAt: null,
        status: TreatmentPlanStatus.ACCEPTED,
        patientId: params.patientId,
      },
    },
    select: { treatmentPlanId: true },
  });
  if (itemLinked?.treatmentPlanId) return itemLinked.treatmentPlanId;

  const accepted = await db.treatmentPlan.findFirst({
    where: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      deletedAt: null,
      status: TreatmentPlanStatus.ACCEPTED,
    },
    orderBy: { acceptedAt: "desc" },
    select: { id: true },
  });
  return accepted?.id ?? null;
}

/**
 * Create (or return existing open) Encounter for an appointment.
 * Walk-in path: treatmentPlanId null.
 */
export async function createEncounterFromAppointment(
  params: CreateEncounterFromAppointmentParams,
) {
  const appointment = await db.appointment.findFirst({
    where: {
      id: params.appointmentId,
      tenantId: params.tenantId,
      deletedAt: null,
      isBlock: false,
    },
    select: { id: true, patientId: true },
  });
  if (!appointment?.patientId) {
    throw new Error("Appointment not found or missing patient.");
  }

  const existing = await db.encounter.findFirst({
    where: {
      tenantId: params.tenantId,
      appointmentId: appointment.id,
      deletedAt: null,
      closedAt: null,
      status: { notIn: ["recall_scheduled"] },
    },
    orderBy: { startedAt: "desc" },
  });
  if (existing) return existing;

  const treatmentPlanId = await resolveTreatmentPlanId({
    tenantId: params.tenantId,
    patientId: appointment.patientId,
    appointmentId: appointment.id,
    walkIn: params.walkIn,
  });

  const encounter = await createEncounterAudited(
    {
      tenant: { connect: { id: params.tenantId } },
      patient: { connect: { id: appointment.patientId } },
      appointment: { connect: { id: appointment.id } },
      ...(treatmentPlanId
        ? { treatmentPlan: { connect: { id: treatmentPlanId } } }
        : {}),
      status: "arrival_intake",
      originRecallId: params.originRecallId ?? null,
      startedAt: new Date(),
    },
    { tenantId: params.tenantId, userId: params.userId },
  );

  if (params.staffMemberId) {
    await createProviderPresenceAudited(
      {
        tenant: { connect: { id: params.tenantId } },
        encounter: { connect: { id: encounter.id } },
        staff: { connect: { id: params.staffMemberId } },
        stage: encounter.status,
        presentFrom: new Date(),
      },
      { tenantId: params.tenantId, userId: params.userId },
    );
  }

  return encounter;
}

async function closeOpenPresence(
  tenantId: string,
  encounterId: string,
  staffMemberId: string | null | undefined,
) {
  if (!staffMemberId) return;
  await db.providerPresence.updateMany({
    where: {
      tenantId,
      encounterId,
      staffId: staffMemberId,
      presentTo: null,
    },
    data: { presentTo: new Date() },
  });
}

export type TransitionEncounterParams = {
  tenantId: string;
  encounterId: string;
  toStatus: EncounterStatus;
  userId?: string;
  staffMemberId?: string | null;
  handoffToStaffId?: string | null;
};

export async function transitionEncounterStatus(params: TransitionEncounterParams) {
  const encounter = await db.encounter.findFirst({
    where: {
      id: params.encounterId,
      tenantId: params.tenantId,
      deletedAt: null,
    },
  });
  if (!encounter) throw new Error("Encounter not found.");
  if (!isEncounterStatus(encounter.status)) {
    throw new Error(`Unknown encounter status: ${encounter.status}`);
  }

  assertTransition(encounter.status as EncounterStatus, params.toStatus);

  const from = encounter.status as EncounterStatus;
  const updated = await updateEncounterAudited(
    encounter.id,
    params.tenantId,
    {
      status: params.toStatus,
      ...(params.toStatus === "billing" || params.toStatus === "recall_scheduled"
        ? {}
        : {}),
    },
    { userId: params.userId },
  );

  await createAuditLog({
    tenantId: params.tenantId,
    userId: params.userId,
    action: AuditAction.UPDATE,
    entity: "Encounter",
    entityId: encounter.id,
    metadata: {
      kind: "status_transition",
      from,
      to: params.toStatus,
    },
  });

  await closeOpenPresence(params.tenantId, encounter.id, params.staffMemberId);
  const presenceStaffId = params.handoffToStaffId ?? params.staffMemberId;
  if (presenceStaffId) {
    await createProviderPresenceAudited(
      {
        tenant: { connect: { id: params.tenantId } },
        encounter: { connect: { id: encounter.id } },
        staff: { connect: { id: presenceStaffId } },
        stage: params.toStatus,
        presentFrom: new Date(),
      },
      { tenantId: params.tenantId, userId: params.userId },
    );
  }

  if (params.handoffToStaffId && params.staffMemberId && params.handoffToStaffId !== params.staffMemberId) {
    await createAuditLog({
      tenantId: params.tenantId,
      userId: params.userId,
      action: AuditAction.UPDATE,
      entity: "Encounter",
      entityId: encounter.id,
      metadata: {
        kind: "provider_handoff",
        fromStaffId: params.staffMemberId,
        toStaffId: params.handoffToStaffId,
        stage: params.toStatus,
      },
    });
  }

  return updated;
}

export type InterruptEncounterParams = {
  tenantId: string;
  encounterId: string;
  incidentNote: string;
  userId?: string;
  staffMemberId?: string | null;
};

export async function interruptEncounter(params: InterruptEncounterParams) {
  const note = params.incidentNote.trim();
  if (!note) throw new Error("An incident note is required to interrupt an encounter.");

  const encounter = await db.encounter.findFirst({
    where: { id: params.encounterId, tenantId: params.tenantId, deletedAt: null },
  });
  if (!encounter) throw new Error("Encounter not found.");
  if (!isEncounterStatus(encounter.status)) {
    throw new Error(`Unknown encounter status: ${encounter.status}`);
  }
  if (!canTransition(encounter.status as EncounterStatus, "interrupted")) {
    throw new Error(`Cannot interrupt from status ${encounter.status}.`);
  }

  const from = encounter.status as EncounterStatus;
  const updated = await updateEncounterAudited(
    encounter.id,
    params.tenantId,
    {
      status: "interrupted",
      statusBeforeInterrupt: from,
      incidentNote: note,
      interruptOutcome: null,
    },
    { userId: params.userId },
  );

  await createAuditLog({
    tenantId: params.tenantId,
    userId: params.userId,
    action: AuditAction.UPDATE,
    entity: "Encounter",
    entityId: encounter.id,
    metadata: { kind: "interrupt", from, incidentNote: note },
  });

  await closeOpenPresence(params.tenantId, encounter.id, params.staffMemberId);
  if (params.staffMemberId) {
    await createProviderPresenceAudited(
      {
        tenant: { connect: { id: params.tenantId } },
        encounter: { connect: { id: encounter.id } },
        staff: { connect: { id: params.staffMemberId } },
        stage: "interrupted",
        presentFrom: new Date(),
      },
      { tenantId: params.tenantId, userId: params.userId },
    );
  }

  return updated;
}

export type ResolveInterruptParams = {
  tenantId: string;
  encounterId: string;
  outcome: InterruptOutcome;
  userId?: string;
  staffMemberId?: string | null;
};

export async function resolveInterrupt(params: ResolveInterruptParams) {
  if (!(INTERRUPT_OUTCOMES as readonly string[]).includes(params.outcome)) {
    throw new Error(`Invalid interrupt outcome: ${params.outcome}`);
  }

  const encounter = await db.encounter.findFirst({
    where: { id: params.encounterId, tenantId: params.tenantId, deletedAt: null },
  });
  if (!encounter) throw new Error("Encounter not found.");
  if (encounter.status !== "interrupted") {
    throw new Error("Encounter is not interrupted.");
  }

  let nextStatus: EncounterStatus;
  let closedAt: Date | null = null;
  let closedReason: string | null = null;

  if (params.outcome === "resumed") {
    const prior = encounter.statusBeforeInterrupt;
    nextStatus =
      prior && isEncounterStatus(prior) && prior !== "interrupted"
        ? prior
        : "procedure_execution";
  } else if (params.outcome === "abandoned_partial_bill") {
    nextStatus = "billing";
    closedReason = "abandoned_partial_bill";
  } else {
    nextStatus = "recall_scheduled";
    closedAt = new Date();
    closedReason = "abandoned_no_bill";
  }

  const updated = await updateEncounterAudited(
    encounter.id,
    params.tenantId,
    {
      status: nextStatus,
      interruptOutcome: params.outcome,
      statusBeforeInterrupt: null,
      closedAt,
      closedReason,
    },
    { userId: params.userId },
  );

  await createAuditLog({
    tenantId: params.tenantId,
    userId: params.userId,
    action: AuditAction.UPDATE,
    entity: "Encounter",
    entityId: encounter.id,
    metadata: {
      kind: "resolve_interrupt",
      outcome: params.outcome,
      to: nextStatus,
    },
  });

  await closeOpenPresence(params.tenantId, encounter.id, params.staffMemberId);
  if (params.staffMemberId && !closedAt) {
    await createProviderPresenceAudited(
      {
        tenant: { connect: { id: params.tenantId } },
        encounter: { connect: { id: encounter.id } },
        staff: { connect: { id: params.staffMemberId } },
        stage: nextStatus,
        presentFrom: new Date(),
      },
      { tenantId: params.tenantId, userId: params.userId },
    );
  }

  return updated;
}

export function encounterSelectForWorkspace() {
  return {
    id: true,
    tenantId: true,
    patientId: true,
    appointmentId: true,
    treatmentPlanId: true,
    originRecallId: true,
    status: true,
    interruptOutcome: true,
    incidentNote: true,
    closedReason: true,
    painScore: true,
    painNextAction: true,
    preAuthOverridden: true,
    preAuthOverrideReason: true,
    patientAckPreAuthAt: true,
    startedAt: true,
    closedAt: true,
    procedureLines: {
      include: {
        procedureCatalog: { select: { id: true, code: true, name: true, price: true } },
        materialUsages: true,
        provider: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: "asc" as const },
    },
    riskAssessments: { orderBy: { createdAt: "desc" as const }, take: 1 },
    consentRecords: {
      where: { purpose: "clinical", revokedAt: null },
      orderBy: { grantedAt: "desc" as const },
      take: 1,
    },
    insuranceVerifications: { orderBy: { createdAt: "desc" as const }, take: 1 },
    clinicalAlerts: {
      where: { acknowledgedAt: null },
      orderBy: { createdAt: "desc" as const },
    },
    billedInvoice: { select: { id: true, invoiceNumber: true, total: true, status: true } },
  } satisfies Prisma.EncounterSelect;
}
