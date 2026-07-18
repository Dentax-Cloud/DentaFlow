"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import {
  createEncounterFromAppointment,
  transitionEncounterStatus,
  interruptEncounter,
  resolveInterrupt,
  encounterSelectForWorkspace,
} from "@/lib/encounter/lifecycle";
import {
  buildLiveGateSummary,
  applyPreAuthOverride,
} from "@/lib/encounter/gate-enforcement";
import {
  addEncounterProcedureLine,
  createEncounterBundle,
  transitionProcedureLineStatus,
  logSterilizationForLine,
  logMaterialUsage,
  recordEncounterPainScore,
  type PainNextAction,
} from "@/lib/encounter/procedure-execution";
import {
  closeAndInvoiceEncounter,
  advanceToProcedureExecutionIfReady,
  EncounterDoubleInvoiceError,
} from "@/lib/encounter/billing";
import {
  createRiskAssessmentAudited,
  updateRiskAssessmentAudited,
  createConsentRecordAudited,
  createInsuranceVerificationAudited,
  updateInsuranceVerificationAudited,
} from "@/lib/encounter/repository";
import {
  resolveEncounterSpineSettings,
  staleAfterMinutesFromSettings,
} from "@/lib/encounter/tenant-settings";
import type { EncounterStatus, EncounterProcedureLineStatus, PlannedVsPerformed } from "@/lib/encounter/types";
import type { InterruptOutcome } from "@/lib/encounter/state-machine";
import type { GateSummary } from "@/lib/encounter/types";

const SPINE_DISABLED_MESSAGE =
  "Encounter spine is not enabled for this clinic. Contact your administrator.";

async function requireSpineWrite() {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);
  if (!isEncounterSpineEnabled(ctx.tenant)) {
    throw new Error(SPINE_DISABLED_MESSAGE);
  }
  return ctx;
}

async function requireSpineRead() {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);
  if (!isEncounterSpineEnabled(ctx.tenant)) {
    throw new Error(SPINE_DISABLED_MESSAGE);
  }
  return ctx;
}

function revalidateSpinePaths(appointmentId?: string | null) {
  revalidatePath("/clinical");
  if (appointmentId) {
    revalidatePath(`/clinical/encounter/${appointmentId}`);
    revalidatePath(`/clinical/encounter/${appointmentId}/spine`);
    revalidatePath(`/clinical/encounter/${appointmentId}/timeline`);
  }
}

function toIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function asNumber(value: unknown, fallback = 0): number {
  if (value == null) return fallback;
  if (typeof value === "number") return Number.isFinite(value) ? value : fallback;
  if (typeof value === "object" && value !== null && "toNumber" in value) {
    try {
      return Number((value as { toNumber: () => number }).toNumber());
    } catch {
      return fallback;
    }
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export type SpineProcedureLineSerialized = {
  id: string;
  encounterId: string;
  treatmentItemId: string | null;
  procedureBundleId: string | null;
  procedureCatalogId: string;
  toothNumbers: string[];
  surfaces: string[];
  status: string;
  plannedVsPerformed: string;
  providerId: string | null;
  unitPrice: number | null;
  sterilizationLoggedAt: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  procedureCatalog: {
    id: string;
    code: string;
    name: string;
    price: number;
  };
  materialUsages: Array<{
    id: string;
    itemId: string;
    tier: string;
    quantity: number;
    unitCost: number;
    lotNumber: string | null;
    expiryDate: string | null;
    deductedAt: string;
  }>;
  provider: {
    id: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
};

export type SpineEncounterSerialized = {
  id: string;
  tenantId: string;
  patientId: string;
  appointmentId: string;
  treatmentPlanId: string | null;
  originRecallId: string | null;
  status: EncounterStatus | string;
  interruptOutcome: string | null;
  incidentNote: string | null;
  closedReason: string | null;
  painScore: number | null;
  painNextAction: string | null;
  preAuthOverridden: boolean;
  preAuthOverrideReason: string | null;
  patientAckPreAuthAt: string | null;
  startedAt: string;
  closedAt: string | null;
  procedureLines: SpineProcedureLineSerialized[];
  riskAssessments: Array<{
    id: string;
    asaClass: string | null;
    clearedAt: string | null;
    createdAt: string;
  }>;
  consentRecords: Array<{
    id: string;
    purpose: string;
    grantedAt: string;
    revokedAt: string | null;
  }>;
  insuranceVerifications: Array<{
    id: string;
    eligibilityStatus: string;
    preAuthStatus: string;
    estimatedCoverage: number;
    estimatedCopay: number;
    verifiedAt: string | null;
    staleAfterMinutes: number;
  }>;
  clinicalAlerts: Array<{
    id: string;
    type: string;
    createdAt: string;
  }>;
  billedInvoice: {
    id: string;
    invoiceNumber: string;
    total: number;
    status: string;
  } | null;
};

export type SpineCatalogSnippet = {
  id: string;
  code: string;
  name: string;
  category: string;
  price: number;
};

export type SpineInventorySnippet = {
  id: string;
  name: string;
  itemRef: string | null;
  unit: string | null;
};

export type SpineWorkspaceData = {
  encounter: SpineEncounterSerialized;
  gates: GateSummary;
  procedures: SpineCatalogSnippet[];
  inventoryItems: SpineInventorySnippet[];
  clinicalImages: Array<{
    id: string;
    url: string;
    type: string;
    fileName: string | null;
    takenAt: string | null;
  }>;
    patient: {
      id: string;
    firstName: string;
    lastName: string;
    patientNumber: string | null;
    allergies: string[];
    medicalHistory: string | null;
    medications: string[];
  };
  painScoreThreshold: number;
};

function serializeProcedureLine(line: {
  id: string;
  encounterId: string;
  treatmentItemId: string | null;
  procedureBundleId: string | null;
  procedureCatalogId: string;
  toothNumbers: string[];
  surfaces: string[];
  status: string;
  plannedVsPerformed: string;
  providerId: string | null;
  unitPrice: unknown;
  sterilizationLoggedAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  createdAt: Date;
  procedureCatalog: { id: string; code: string; name: string; price: unknown };
  materialUsages: Array<{
    id: string;
    itemId: string;
    tier: string;
    quantity: unknown;
    unitCost: unknown;
    lotNumber: string | null;
    expiryDate: Date | null;
    deductedAt: Date;
  }>;
  provider: { id: string; firstName: string | null; lastName: string | null } | null;
}): SpineProcedureLineSerialized {
  const catalog = serializeDecimal(line.procedureCatalog as Record<string, unknown>);
  return {
    id: line.id,
    encounterId: line.encounterId,
    treatmentItemId: line.treatmentItemId,
    procedureBundleId: line.procedureBundleId,
    procedureCatalogId: line.procedureCatalogId,
    toothNumbers: line.toothNumbers,
    surfaces: line.surfaces,
    status: line.status,
    plannedVsPerformed: line.plannedVsPerformed,
    providerId: line.providerId,
    unitPrice: line.unitPrice != null ? asNumber(serializeDecimal({ unitPrice: line.unitPrice }).unitPrice) : null,
    sterilizationLoggedAt: toIso(line.sterilizationLoggedAt),
    startedAt: toIso(line.startedAt),
    completedAt: toIso(line.completedAt),
    createdAt: toIso(line.createdAt)!,
    procedureCatalog: {
      id: line.procedureCatalog.id,
      code: line.procedureCatalog.code,
      name: line.procedureCatalog.name,
      price: asNumber(catalog.price),
    },
    materialUsages: line.materialUsages.map((u) => {
      const s = serializeDecimal(u as Record<string, unknown>);
      return {
        id: u.id,
        itemId: u.itemId,
        tier: u.tier,
        quantity: asNumber(s.quantity),
        unitCost: asNumber(s.unitCost),
        lotNumber: u.lotNumber,
        expiryDate: toIso(u.expiryDate),
        deductedAt: toIso(u.deductedAt)!,
      };
    }),
    provider: line.provider,
  };
}

function serializeEncounterWorkspace(
  row: Prisma.EncounterGetPayload<{ select: ReturnType<typeof encounterSelectForWorkspace> }>,
): SpineEncounterSerialized {
  const invoice = row.billedInvoice
    ? serializeDecimal(row.billedInvoice as Record<string, unknown>)
    : null;

  return {
    id: row.id,
    tenantId: row.tenantId,
    patientId: row.patientId,
    appointmentId: row.appointmentId,
    treatmentPlanId: row.treatmentPlanId,
    originRecallId: row.originRecallId,
    status: row.status,
    interruptOutcome: row.interruptOutcome,
    incidentNote: row.incidentNote,
    closedReason: row.closedReason,
    painScore: row.painScore,
    painNextAction: row.painNextAction,
    preAuthOverridden: row.preAuthOverridden,
    preAuthOverrideReason: row.preAuthOverrideReason,
    patientAckPreAuthAt: toIso(row.patientAckPreAuthAt),
    startedAt: toIso(row.startedAt)!,
    closedAt: toIso(row.closedAt),
    procedureLines: row.procedureLines.map(serializeProcedureLine),
    riskAssessments: row.riskAssessments.map((r) => ({
      id: r.id,
      asaClass: r.asaClass,
      clearedAt: toIso(r.clearedAt),
      createdAt: toIso(r.createdAt)!,
    })),
    consentRecords: row.consentRecords.map((c) => ({
      id: c.id,
      purpose: c.purpose,
      grantedAt: toIso(c.grantedAt)!,
      revokedAt: toIso(c.revokedAt),
    })),
    insuranceVerifications: row.insuranceVerifications.map((v) => {
      const s = serializeDecimal(v as Record<string, unknown>);
      return {
        id: v.id,
        eligibilityStatus: v.eligibilityStatus,
        preAuthStatus: v.preAuthStatus,
        estimatedCoverage: asNumber(s.estimatedCoverage),
        estimatedCopay: asNumber(s.estimatedCopay),
        verifiedAt: toIso(v.verifiedAt),
        staleAfterMinutes: v.staleAfterMinutes,
      };
    }),
    clinicalAlerts: row.clinicalAlerts.map((a) => ({
      id: a.id,
      type: a.type,
      createdAt: toIso(a.createdAt)!,
    })),
    billedInvoice: invoice
      ? {
          id: String(invoice.id),
          invoiceNumber: String(invoice.invoiceNumber),
          total: asNumber(invoice.total),
          status: String(invoice.status),
        }
      : null,
  };
}

async function loadEncounterForWorkspace(tenantId: string, encounterId: string) {
  return db.encounter.findFirst({
    where: { id: encounterId, tenantId, deletedAt: null },
    select: encounterSelectForWorkspace(),
  });
}

async function assertEncounterOwned(tenantId: string, encounterId: string) {
  const encounter = await db.encounter.findFirst({
    where: { id: encounterId, tenantId, deletedAt: null },
    select: { id: true, appointmentId: true, patientId: true },
  });
  if (!encounter) throw new Error("Encounter not found.");
  return encounter;
}

export async function getOrCreateSpineEncounter(
  appointmentId: string,
  opts?: { walkIn?: boolean; originRecallId?: string },
) {
  const ctx = await requireSpineWrite();
  const encounter = await createEncounterFromAppointment({
    tenantId: ctx.tenantId,
    appointmentId,
    userId: ctx.staffMember?.id,
    staffMemberId: ctx.staffMember?.id ?? null,
    walkIn: opts?.walkIn,
    originRecallId: opts?.originRecallId,
  });
  revalidateSpinePaths(appointmentId);
  return encounter;
}

export async function transitionSpineEncounter(input: {
  encounterId: string;
  toStatus: EncounterStatus;
  handoffToStaffId?: string;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  const updated = await transitionEncounterStatus({
    tenantId: ctx.tenantId,
    encounterId: input.encounterId,
    toStatus: input.toStatus,
    userId: ctx.staffMember?.id,
    staffMemberId: ctx.staffMember?.id ?? null,
    handoffToStaffId: input.handoffToStaffId,
  });
  revalidateSpinePaths(owned.appointmentId);
  return updated;
}

export async function interruptSpineEncounter(input: {
  encounterId: string;
  incidentNote: string;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  const updated = await interruptEncounter({
    tenantId: ctx.tenantId,
    encounterId: input.encounterId,
    incidentNote: input.incidentNote,
    userId: ctx.staffMember?.id,
    staffMemberId: ctx.staffMember?.id ?? null,
  });
  revalidateSpinePaths(owned.appointmentId);
  return updated;
}

export async function resolveSpineInterrupt(input: {
  encounterId: string;
  outcome: InterruptOutcome;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  const updated = await resolveInterrupt({
    tenantId: ctx.tenantId,
    encounterId: input.encounterId,
    outcome: input.outcome,
    userId: ctx.staffMember?.id,
    staffMemberId: ctx.staffMember?.id ?? null,
  });
  revalidateSpinePaths(owned.appointmentId);
  return updated;
}

export async function clearSpineRisk(input: {
  encounterId: string;
  asaClass?: string;
  vitalsSnapshot?: Record<string, unknown>;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  if (!ctx.staffMember?.id) {
    throw new Error("Staff member required to clear risk assessment.");
  }

  const existing = await db.riskAssessment.findFirst({
    where: { tenantId: ctx.tenantId, encounterId: input.encounterId },
    orderBy: { createdAt: "desc" },
  });

  const now = new Date();
  const vitals =
    input.vitalsSnapshot != null
      ? (input.vitalsSnapshot as Prisma.InputJsonValue)
      : undefined;

  if (existing && !existing.clearedAt) {
    await updateRiskAssessmentAudited(
      existing.id,
      ctx.tenantId,
      {
        asaClass: input.asaClass?.trim() || existing.asaClass,
        ...(vitals != null ? { vitalsSnapshot: vitals } : {}),
        clearedAt: now,
        clearedByStaff: { connect: { id: ctx.staffMember.id } },
      },
      { userId: ctx.staffMember?.id },
    );
  } else {
    await createRiskAssessmentAudited(
      {
        tenant: { connect: { id: ctx.tenantId } },
        encounter: { connect: { id: input.encounterId } },
        asaClass: input.asaClass?.trim() || null,
        ...(vitals != null ? { vitalsSnapshot: vitals } : { vitalsSnapshot: {} }),
        clearedAt: now,
        clearedByStaff: { connect: { id: ctx.staffMember.id } },
      },
      { tenantId: ctx.tenantId, userId: ctx.staffMember?.id },
    );
  }

  revalidateSpinePaths(owned.appointmentId);
  return { ok: true as const };
}

export async function grantSpineConsent(input: { encounterId: string }) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);

  const { assertRiskClearedForEncounter } = await import("@/lib/encounter/gate-enforcement");
  await assertRiskClearedForEncounter(ctx.tenantId, input.encounterId);

  const active = await db.consentRecord.findFirst({
    where: {
      tenantId: ctx.tenantId,
      encounterId: input.encounterId,
      purpose: "clinical",
      revokedAt: null,
    },
    orderBy: { grantedAt: "desc" },
  });
  if (active) {
    revalidateSpinePaths(owned.appointmentId);
    return active;
  }

  const record = await createConsentRecordAudited(
    {
      tenant: { connect: { id: ctx.tenantId } },
      encounter: { connect: { id: input.encounterId } },
      purpose: "clinical",
      grantedAt: new Date(),
    },
    { tenantId: ctx.tenantId, userId: ctx.staffMember?.id },
  );
  revalidateSpinePaths(owned.appointmentId);
  return record;
}

export async function upsertSpineInsuranceVerification(input: {
  encounterId: string;
  eligibilityStatus: string;
  preAuthStatus: string;
  estimatedCoverage?: number;
  estimatedCopay?: number;
  verifiedAt?: string | Date | null;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);

  const { assertRiskClearedForEncounter } = await import("@/lib/encounter/gate-enforcement");
  await assertRiskClearedForEncounter(ctx.tenantId, input.encounterId);

  const [settingsRow, tenant] = await Promise.all([
    db.settings.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { encounterSpineSettings: true },
    }),
    db.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { featureFlags: true },
    }),
  ]);
  const spineSettings = resolveEncounterSpineSettings({
    settingsJson: settingsRow?.encounterSpineSettings as Record<string, unknown> | null,
    featureFlags: tenant?.featureFlags as Record<string, unknown> | null,
  });
  const staleAfterMinutes = staleAfterMinutesFromSettings(spineSettings);

  const verifiedAt =
    input.verifiedAt === undefined || input.verifiedAt === null
      ? new Date()
      : input.verifiedAt instanceof Date
        ? input.verifiedAt
        : new Date(input.verifiedAt);

  const existing = await db.insuranceVerification.findFirst({
    where: { tenantId: ctx.tenantId, encounterId: input.encounterId },
    orderBy: { createdAt: "desc" },
  });

  const coverage =
    input.estimatedCoverage != null ? new Prisma.Decimal(input.estimatedCoverage) : undefined;
  const copay =
    input.estimatedCopay != null ? new Prisma.Decimal(input.estimatedCopay) : undefined;

  let row;
  if (existing) {
    row = await updateInsuranceVerificationAudited(
      existing.id,
      ctx.tenantId,
      {
        eligibilityStatus: input.eligibilityStatus,
        preAuthStatus: input.preAuthStatus,
        ...(coverage != null ? { estimatedCoverage: coverage } : {}),
        ...(copay != null ? { estimatedCopay: copay } : {}),
        verifiedAt,
        staleAfterMinutes,
      },
      { userId: ctx.staffMember?.id },
    );
  } else {
    row = await createInsuranceVerificationAudited(
      {
        tenant: { connect: { id: ctx.tenantId } },
        encounter: { connect: { id: input.encounterId } },
        eligibilityStatus: input.eligibilityStatus,
        preAuthStatus: input.preAuthStatus,
        estimatedCoverage: coverage ?? new Prisma.Decimal(0),
        estimatedCopay: copay ?? new Prisma.Decimal(0),
        verifiedAt,
        staleAfterMinutes,
      },
      { tenantId: ctx.tenantId, userId: ctx.staffMember?.id },
    );
  }

  revalidateSpinePaths(owned.appointmentId);
  return serializeDecimal(row as Record<string, unknown>);
}

export async function overrideSpinePreAuth(input: {
  encounterId: string;
  reason: string;
  patientAcknowledged: boolean;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  if (!ctx.staffMember?.id || !ctx.staffMember.role) {
    throw new Error("Staff member required to override pre-authorization.");
  }

  await applyPreAuthOverride({
    tenantId: ctx.tenantId,
    encounterId: input.encounterId,
    userId: ctx.staffMember?.id,
    staffMemberId: ctx.staffMember.id,
    role: ctx.staffMember.role,
    reason: input.reason,
    patientAcknowledged: input.patientAcknowledged,
  });

  revalidateSpinePaths(owned.appointmentId);
  return { ok: true as const };
}

export async function addSpineProcedureLine(input: {
  encounterId: string;
  procedureCatalogId: string;
  treatmentItemId?: string | null;
  procedureBundleId?: string | null;
  toothNumbers?: string[];
  surfaces?: string[];
  plannedVsPerformed?: PlannedVsPerformed;
  unitPrice?: number | null;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  const line = await addEncounterProcedureLine({
    tenantId: ctx.tenantId,
    encounterId: input.encounterId,
    procedureCatalogId: input.procedureCatalogId,
    treatmentItemId: input.treatmentItemId,
    procedureBundleId: input.procedureBundleId,
    toothNumbers: input.toothNumbers,
    surfaces: input.surfaces,
    plannedVsPerformed: input.plannedVsPerformed,
    providerId: ctx.staffMember?.id ?? null,
    unitPrice: input.unitPrice,
    userId: ctx.staffMember?.id,
  });
  revalidateSpinePaths(owned.appointmentId);
  return serializeDecimal(line as Record<string, unknown>);
}

export async function createSpineBundle(input: {
  encounterId: string;
  name: string;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  const bundle = await createEncounterBundle({
    tenantId: ctx.tenantId,
    encounterId: input.encounterId,
    name: input.name,
    userId: ctx.staffMember?.id,
  });
  revalidateSpinePaths(owned.appointmentId);
  return bundle;
}

export async function transitionSpineProcedureLine(input: {
  lineId: string;
  toStatus: EncounterProcedureLineStatus;
}) {
  const ctx = await requireSpineWrite();
  const line = await db.encounterProcedureLine.findFirst({
    where: { id: input.lineId, tenantId: ctx.tenantId },
    select: { encounterId: true, encounter: { select: { appointmentId: true } } },
  });
  if (!line) throw new Error("Procedure line not found.");

  const updated = await transitionProcedureLineStatus({
    tenantId: ctx.tenantId,
    lineId: input.lineId,
    toStatus: input.toStatus,
    providerId: ctx.staffMember?.id ?? null,
    userId: ctx.staffMember?.id,
  });
  revalidateSpinePaths(line.encounter.appointmentId);
  return serializeDecimal(updated as Record<string, unknown>);
}

export async function logSpineSterilization(input: { lineId: string }) {
  const ctx = await requireSpineWrite();
  const line = await db.encounterProcedureLine.findFirst({
    where: { id: input.lineId, tenantId: ctx.tenantId },
    select: { encounter: { select: { appointmentId: true } } },
  });
  if (!line) throw new Error("Procedure line not found.");

  const updated = await logSterilizationForLine({
    tenantId: ctx.tenantId,
    lineId: input.lineId,
    userId: ctx.staffMember?.id,
  });
  revalidateSpinePaths(line.encounter.appointmentId);
  return serializeDecimal(updated as Record<string, unknown>);
}

export async function logSpineMaterial(input: {
  procedureLineId: string;
  itemId: string;
  tier: "tracked" | "consumable";
  quantity: number;
  lotNumber?: string | null;
  expiryDate?: string | Date | null;
}) {
  const ctx = await requireSpineWrite();
  const line = await db.encounterProcedureLine.findFirst({
    where: { id: input.procedureLineId, tenantId: ctx.tenantId },
    select: { encounter: { select: { appointmentId: true } } },
  });
  if (!line) throw new Error("Procedure line not found.");

  const expiryDate =
    input.expiryDate == null || input.expiryDate === ""
      ? null
      : input.expiryDate instanceof Date
        ? input.expiryDate
        : new Date(input.expiryDate);

  const usage = await logMaterialUsage({
    tenantId: ctx.tenantId,
    procedureLineId: input.procedureLineId,
    itemId: input.itemId,
    tier: input.tier,
    quantity: input.quantity,
    lotNumber: input.lotNumber,
    expiryDate,
    userId: ctx.staffMember?.id,
  });
  revalidateSpinePaths(line.encounter.appointmentId);
  return serializeDecimal(usage as Record<string, unknown>);
}

export async function recordSpinePainScore(input: {
  encounterId: string;
  painScore: number;
  nextAction?: PainNextAction | null;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  const updated = await recordEncounterPainScore({
    tenantId: ctx.tenantId,
    encounterId: input.encounterId,
    painScore: input.painScore,
    nextAction: input.nextAction,
    userId: ctx.staffMember?.id,
    staffMemberId: ctx.staffMember?.id ?? null,
  });
  revalidateSpinePaths(owned.appointmentId);
  return updated;
}

export async function advanceSpinePastGates(encounterId: string) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, encounterId);
  const updated = await advanceToProcedureExecutionIfReady({
    tenantId: ctx.tenantId,
    encounterId,
    userId: ctx.staffMember?.id,
    staffMemberId: ctx.staffMember?.id ?? null,
  });
  revalidateSpinePaths(owned.appointmentId);
  return updated;
}

export async function closeAndInvoiceSpineEncounter(
  encounterId: string,
  opts?: { closedReason?: string },
) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, encounterId);
  try {
    const invoice = await closeAndInvoiceEncounter({
      tenantId: ctx.tenantId,
      encounterId,
      userId: ctx.staffMember?.id,
      staffMemberId: ctx.staffMember?.id ?? null,
      closedReason: opts?.closedReason,
    });
    revalidateSpinePaths(owned.appointmentId);
    revalidatePath("/billing");
    return serializeDecimal(invoice as Record<string, unknown>);
  } catch (e) {
    if (e instanceof EncounterDoubleInvoiceError) throw e;
    throw e;
  }
}

export async function loadSpineWorkspaceData(
  appointmentId: string,
): Promise<SpineWorkspaceData> {
  const ctx = await requireSpineRead();

  const appointment = await db.appointment.findFirst({
    where: {
      id: appointmentId,
      tenantId: ctx.tenantId,
      deletedAt: null,
      isBlock: false,
    },
    select: {
      id: true,
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          patientNumber: true,
          allergies: true,
          medicalHistory: true,
          medications: true,
        },
      },
    },
  });
  if (!appointment?.patient) {
    throw new Error("Appointment not found or missing patient.");
  }

  let encounterRow = await db.encounter.findFirst({
    where: {
      tenantId: ctx.tenantId,
      appointmentId,
      deletedAt: null,
      closedAt: null,
      status: { notIn: ["recall_scheduled"] },
    },
    orderBy: { startedAt: "desc" },
    select: encounterSelectForWorkspace(),
  });

  // After close & invoice, keep showing the closed encounter — do not spawn a
  // fresh open session on every refresh for the same appointment.
  if (!encounterRow) {
    encounterRow = await db.encounter.findFirst({
      where: {
        tenantId: ctx.tenantId,
        appointmentId,
        deletedAt: null,
      },
      orderBy: { startedAt: "desc" },
      select: encounterSelectForWorkspace(),
    });
  }

  if (!encounterRow) {
    // Writers create; readers may still fail if none exists
    try {
      await requirePermission(PERMISSIONS.clinical_chart.write);
      const created = await createEncounterFromAppointment({
        tenantId: ctx.tenantId,
        appointmentId,
        userId: ctx.staffMember?.id,
        staffMemberId: ctx.staffMember?.id ?? null,
      });
      encounterRow = await loadEncounterForWorkspace(ctx.tenantId, created.id);
    } catch {
      throw new Error("No open encounter for this appointment.");
    }
  }

  if (!encounterRow) throw new Error("Encounter not found.");

  const [gatesResult, procedures, inventoryItems, settingsRow, clinicalImages] =
    await Promise.all([
      buildLiveGateSummary(ctx.tenantId, encounterRow.id).catch(() => ({
        risk: "unknown" as const,
        consent: "unknown" as const,
        insurance: "unknown" as const,
        sterilization: "unknown" as const,
      })),
      db.procedureCatalog.findMany({
        where: { tenantId: ctx.tenantId, isActive: true },
        orderBy: { name: "asc" },
        take: 200,
        select: { id: true, code: true, name: true, category: true, price: true },
      }),
      db.inventoryItem.findMany({
        where: { tenantId: ctx.tenantId, deletedAt: null },
        orderBy: { name: "asc" },
        take: 100,
        select: { id: true, name: true, itemRef: true, unit: true },
      }),
      db.settings.findUnique({
        where: { tenantId: ctx.tenantId },
        select: { encounterSpineSettings: true },
      }),
      db.clinicalImage.findMany({
        where: {
          tenantId: ctx.tenantId,
          patientId: appointment.patient.id,
        },
        orderBy: { takenAt: "desc" },
        take: 12,
        select: { id: true, url: true, type: true, fileName: true, takenAt: true },
      }),
    ]);

  const gates = gatesResult;
  const spineSettings = resolveEncounterSpineSettings({
    settingsJson: settingsRow?.encounterSpineSettings as Record<string, unknown> | null,
    featureFlags: ctx.tenant.featureFlags as Record<string, unknown> | null,
  });

  const medicalHistoryText =
    appointment.patient.medicalHistory &&
    typeof appointment.patient.medicalHistory === "object"
      ? JSON.stringify(appointment.patient.medicalHistory)
      : typeof appointment.patient.medicalHistory === "string"
        ? appointment.patient.medicalHistory
        : null;

  return {
    encounter: serializeEncounterWorkspace(encounterRow),
    gates,
    procedures: procedures.map((p) => {
      const s = serializeDecimal(p as Record<string, unknown>);
      return {
        id: p.id,
        code: p.code,
        name: p.name,
        category: p.category ?? "",
        price: asNumber(s.price),
      };
    }),
    inventoryItems: inventoryItems.map((i) => ({
      id: i.id,
      name: i.name,
      itemRef: i.itemRef,
      unit: i.unit,
    })),
    clinicalImages: clinicalImages.map((img) => ({
      id: img.id,
      url: img.url,
      type: img.type,
      fileName: img.fileName,
      takenAt: img.takenAt?.toISOString() ?? null,
    })),
    patient: {
      id: appointment.patient.id,
      firstName: appointment.patient.firstName,
      lastName: appointment.patient.lastName,
      patientNumber: appointment.patient.patientNumber,
      allergies: appointment.patient.allergies,
      medicalHistory: medicalHistoryText,
      medications: appointment.patient.medications ?? [],
    },
    painScoreThreshold: spineSettings.painScoreThreshold,
  };
}

export async function scheduleSpineRecall(input: {
  encounterId: string;
  intervalMonths?: number;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  const months =
    typeof input.intervalMonths === "number" && input.intervalMonths > 0
      ? Math.min(24, Math.round(input.intervalMonths))
      : undefined;

  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { metadata: true },
  });
  const { parseRecallSettings } = await import("@/lib/recall/helpers");
  const settings = parseRecallSettings(tenant?.metadata);
  const dueDate = new Date();
  dueDate.setMonth(dueDate.getMonth() + (months ?? settings.defaultIntervalMonths));

  const existing = await db.recall.findFirst({
    where: {
      tenantId: ctx.tenantId,
      patientId: owned.patientId,
      status: "PENDING",
      completedAt: null,
      dueDate: { gte: new Date() },
    },
    orderBy: { dueDate: "asc" },
  });
  if (existing) {
    revalidateSpinePaths(owned.appointmentId);
    return {
      id: existing.id,
      dueDate: existing.dueDate.toISOString(),
      created: false as const,
    };
  }

  const recall = await db.recall.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: owned.patientId,
      type: "ROUTINE",
      dueDate,
      status: "PENDING",
      notes: `Scheduled from spine encounter ${input.encounterId}`,
    },
  });

  const { createAuditLog } = await import("@/lib/actions/safe-action");
  const { AuditAction } = await import("@prisma/client");
  await createAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.staffMember?.id,
    action: AuditAction.CREATE,
    entity: "Recall",
    entityId: recall.id,
    metadata: { encounterId: input.encounterId, dueDate: dueDate.toISOString() },
  });

  revalidateSpinePaths(owned.appointmentId);
  return {
    id: recall.id,
    dueDate: recall.dueDate.toISOString(),
    created: true as const,
  };
}

export async function saveSpineCloseOutNote(input: {
  encounterId: string;
  prescriptionText: string;
  acknowledgeAllergyConflict?: boolean;
  clinicalNote?: string;
}) {
  const ctx = await requireSpineWrite();
  const owned = await assertEncounterOwned(ctx.tenantId, input.encounterId);
  const patient = await db.patient.findFirst({
    where: { id: owned.patientId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, allergies: true },
  });
  if (!patient) throw new Error("Patient not found.");

  const { findPrescriptionAllergyConflicts } = await import("@/lib/encounter/close-out");
  const conflicts = findPrescriptionAllergyConflicts(
    patient.allergies,
    input.prescriptionText,
  );
  if (conflicts.length > 0 && !input.acknowledgeAllergyConflict) {
    throw new Error(
      `Allergy conflict: prescription may relate to ${conflicts
        .map((c) => c.allergy)
        .join(", ")}. Acknowledge to proceed.`,
    );
  }

  const parts = [
    input.prescriptionText.trim()
      ? `Prescription / meds:\n${input.prescriptionText.trim()}`
      : "",
    input.clinicalNote?.trim() ? `Close-out note:\n${input.clinicalNote.trim()}` : "",
    conflicts.length
      ? `Allergy acknowledgment: ${conflicts.map((c) => c.allergy).join(", ")}`
      : "",
  ].filter(Boolean);

  if (parts.length === 0) {
    throw new Error("Enter a prescription or clinical close-out note.");
  }

  if (!ctx.staffMember?.id) {
    throw new Error("Staff member required to save close-out note.");
  }

  const note = await db.clinicalNote.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: patient.id,
      providerId: ctx.staffMember.id,
      appointmentId: owned.appointmentId,
      noteType: "SOAP",
      title: "Spine close-out",
      rawNotes: parts.join("\n\n"),
      plan: input.prescriptionText.trim() || null,
      assessment: input.clinicalNote?.trim() || null,
      toothNumbers: [],
      signedAt: new Date(),
      signedByName: `${ctx.staffMember.firstName ?? ""} ${ctx.staffMember.lastName ?? ""}`.trim(),
    },
  });

  const { createAuditLog } = await import("@/lib/actions/safe-action");
  const { AuditAction } = await import("@prisma/client");
  await createAuditLog({
    tenantId: ctx.tenantId,
    userId: ctx.staffMember.id,
    action: AuditAction.CREATE,
    entity: "ClinicalNote",
    entityId: note.id,
    metadata: {
      kind: "spine_close_out",
      encounterId: input.encounterId,
      allergyConflicts: conflicts,
      acknowledged: Boolean(input.acknowledgeAllergyConflict),
    },
  });

  revalidateSpinePaths(owned.appointmentId);
  return { noteId: note.id, allergyConflicts: conflicts };
}
