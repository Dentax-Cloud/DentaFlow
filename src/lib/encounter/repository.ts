import { AuditAction, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/actions/safe-action";

type AuditMeta = {
  tenantId: string;
  userId?: string;
  entity: string;
  entityId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
};

async function audit(params: AuditMeta) {
  await createAuditLog({
    tenantId: params.tenantId,
    userId: params.userId,
    action: params.action,
    entity: params.entity,
    entityId: params.entityId,
    metadata: params.metadata,
  });
}

export async function createEncounterAudited(
  data: Prisma.EncounterCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.encounter.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "Encounter",
    entityId: row.id,
    metadata: { status: row.status, appointmentId: row.appointmentId },
  });
  return row;
}

export async function updateEncounterAudited(
  id: string,
  tenantId: string,
  data: Prisma.EncounterUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.encounter.update({
    where: { id },
    data,
  });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "Encounter",
    entityId: row.id,
    metadata: { status: row.status },
  });
  return row;
}

export async function createEncounterProcedureLineAudited(
  data: Prisma.EncounterProcedureLineCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.encounterProcedureLine.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "EncounterProcedureLine",
    entityId: row.id,
    metadata: { encounterId: row.encounterId, status: row.status },
  });
  return row;
}

export async function updateEncounterProcedureLineAudited(
  id: string,
  tenantId: string,
  data: Prisma.EncounterProcedureLineUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.encounterProcedureLine.update({ where: { id }, data });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "EncounterProcedureLine",
    entityId: row.id,
    metadata: { status: row.status },
  });
  return row;
}

export async function createRiskAssessmentAudited(
  data: Prisma.RiskAssessmentCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.riskAssessment.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "RiskAssessment",
    entityId: row.id,
    metadata: { encounterId: row.encounterId },
  });
  return row;
}

export async function updateRiskAssessmentAudited(
  id: string,
  tenantId: string,
  data: Prisma.RiskAssessmentUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.riskAssessment.update({ where: { id }, data });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "RiskAssessment",
    entityId: row.id,
    metadata: { clearedAt: row.clearedAt?.toISOString() ?? null },
  });
  return row;
}

export async function createConsentRecordAudited(
  data: Prisma.ConsentRecordCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.consentRecord.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "ConsentRecord",
    entityId: row.id,
    metadata: { purpose: row.purpose, encounterId: row.encounterId },
  });
  return row;
}

export async function updateConsentRecordAudited(
  id: string,
  tenantId: string,
  data: Prisma.ConsentRecordUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.consentRecord.update({ where: { id }, data });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "ConsentRecord",
    entityId: row.id,
    metadata: { revokedAt: row.revokedAt?.toISOString() ?? null },
  });
  return row;
}

export async function createInsuranceVerificationAudited(
  data: Prisma.InsuranceVerificationCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.insuranceVerification.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "InsuranceVerification",
    entityId: row.id,
    metadata: {
      eligibilityStatus: row.eligibilityStatus,
      preAuthStatus: row.preAuthStatus,
    },
  });
  return row;
}

export async function updateInsuranceVerificationAudited(
  id: string,
  tenantId: string,
  data: Prisma.InsuranceVerificationUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.insuranceVerification.update({ where: { id }, data });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "InsuranceVerification",
    entityId: row.id,
    metadata: {
      eligibilityStatus: row.eligibilityStatus,
      preAuthStatus: row.preAuthStatus,
    },
  });
  return row;
}

export async function createMaterialUsageAudited(
  data: Prisma.MaterialUsageCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.materialUsage.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "MaterialUsage",
    entityId: row.id,
    metadata: { procedureLineId: row.procedureLineId, tier: row.tier },
  });
  return row;
}

export async function updateMaterialUsageAudited(
  id: string,
  tenantId: string,
  data: Prisma.MaterialUsageUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.materialUsage.update({ where: { id }, data });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "MaterialUsage",
    entityId: row.id,
  });
  return row;
}

export async function createLabCaseAudited(
  data: Prisma.LabCaseCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.labCase.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "LabCase",
    entityId: row.id,
    metadata: { status: row.status, procedureLineId: row.procedureLineId },
  });
  return row;
}

export async function updateLabCaseAudited(
  id: string,
  tenantId: string,
  data: Prisma.LabCaseUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.labCase.update({ where: { id }, data });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "LabCase",
    entityId: row.id,
    metadata: { status: row.status },
  });
  return row;
}

export async function createClinicalAlertAudited(
  data: Prisma.ClinicalAlertCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.clinicalAlert.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "ClinicalAlert",
    entityId: row.id,
    metadata: { type: row.type, encounterId: row.encounterId },
  });
  return row;
}

export async function updateClinicalAlertAudited(
  id: string,
  tenantId: string,
  data: Prisma.ClinicalAlertUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.clinicalAlert.update({ where: { id }, data });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "ClinicalAlert",
    entityId: row.id,
    metadata: { acknowledgedAt: row.acknowledgedAt?.toISOString() ?? null },
  });
  return row;
}

export async function createProviderPresenceAudited(
  data: Prisma.ProviderPresenceCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.providerPresence.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "ProviderPresence",
    entityId: row.id,
    metadata: { stage: row.stage, staffId: row.staffId },
  });
  return row;
}

export async function updateProviderPresenceAudited(
  id: string,
  tenantId: string,
  data: Prisma.ProviderPresenceUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.providerPresence.update({ where: { id }, data });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "ProviderPresence",
    entityId: row.id,
    metadata: { presentTo: row.presentTo?.toISOString() ?? null },
  });
  return row;
}

export async function createEncounterProcedureBundleAudited(
  data: Prisma.EncounterProcedureBundleCreateInput,
  actor: { tenantId: string; userId?: string },
) {
  const row = await db.encounterProcedureBundle.create({ data });
  await audit({
    tenantId: actor.tenantId,
    userId: actor.userId,
    action: AuditAction.CREATE,
    entity: "EncounterProcedureBundle",
    entityId: row.id,
    metadata: { name: row.name, encounterId: row.encounterId },
  });
  return row;
}

export async function updateEncounterProcedureBundleAudited(
  id: string,
  tenantId: string,
  data: Prisma.EncounterProcedureBundleUpdateInput,
  actor: { userId?: string },
) {
  const row = await db.encounterProcedureBundle.update({ where: { id }, data });
  await audit({
    tenantId,
    userId: actor.userId,
    action: AuditAction.UPDATE,
    entity: "EncounterProcedureBundle",
    entityId: row.id,
    metadata: { name: row.name },
  });
  return row;
}
