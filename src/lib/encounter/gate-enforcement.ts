import { AuditAction } from "@prisma/client";
import { db } from "@/lib/db";
import { createAuditLog } from "@/lib/actions/safe-action";
import { evaluateEncounterGates, canOverridePreAuth, overridePreAuthGate } from "./gates";
import { evaluateRiskGate } from "./gates/risk";
import { evaluateConsentGate } from "./gates/consent";
import { evaluateInsuranceGate } from "./gates/insurance";
import { evaluateSterilizationGates } from "./gates/sterilization";
import {
  resolveEncounterSpineSettings,
  staleAfterMinutesFromSettings,
} from "./tenant-settings";
import type { UserRole } from "@prisma/client";
import type { GateSummary } from "./types";

const UNKNOWN_GATES: GateSummary = {
  risk: "unknown",
  consent: "unknown",
  insurance: "unknown",
  sterilization: "unknown",
};

/**
 * Read-path gate summary from already-loaded records.
 * Evaluates each gate independently for UI display — missing/empty records
 * become blocked/pending statuses (evaluate* helpers return, never throw).
 * Write-path asserts remain: assertRiskClearedForEncounter /
 * assertProcedureStartGatesAllowed (illegal ops only).
 */
export function summarizeGatesFromRecords(input: {
  risk: Parameters<typeof evaluateRiskGate>[0];
  consent: Parameters<typeof evaluateConsentGate>[0];
  insurance: Parameters<typeof evaluateInsuranceGate>[0];
  sterilizationLogs: Parameters<typeof evaluateSterilizationGates>[0];
  preAuthOverridden?: boolean;
  now?: Date;
}): GateSummary {
  const risk = evaluateRiskGate(input.risk ?? null);
  const consent = evaluateConsentGate(input.consent ?? null);
  const insurance = evaluateInsuranceGate(input.insurance ?? null, {
    preAuthOverridden: input.preAuthOverridden,
    now: input.now,
  });
  const sterilization = evaluateSterilizationGates(input.sterilizationLogs ?? []);

  const sterilAllClear =
    sterilization.length === 0
      ? "pending"
      : sterilization.every((s) => s.cleared)
        ? "cleared"
        : "blocked";

  return {
    risk: risk.cleared ? "cleared" : "blocked",
    consent: consent.cleared ? "cleared" : "blocked",
    insurance: insurance.cleared ? "cleared" : "blocked",
    sterilization: sterilAllClear,
  };
}

export async function assertRiskClearedForEncounter(
  tenantId: string,
  encounterId: string,
): Promise<void> {
  const risk = await db.riskAssessment.findFirst({
    where: { tenantId, encounterId },
    orderBy: { createdAt: "desc" },
  });
  const result = evaluateRiskGate(risk);
  if (!result.cleared) {
    throw new Error(result.reason ?? "Risk assessment must be cleared before this step.");
  }
}

export async function loadGateBundleForEncounter(tenantId: string, encounterId: string) {
  const [encounter, settings] = await Promise.all([
    db.encounter.findFirst({
      where: { id: encounterId, tenantId, deletedAt: null },
      include: {
        riskAssessments: { orderBy: { createdAt: "desc" }, take: 1 },
        consentRecords: {
          where: { purpose: "clinical", revokedAt: null },
          orderBy: { grantedAt: "desc" },
          take: 1,
        },
        insuranceVerifications: { orderBy: { createdAt: "desc" }, take: 1 },
        procedureLines: {
          where: { status: { in: ["planned", "in_progress", "completed", "interrupted"] } },
          select: { id: true, sterilizationLoggedAt: true },
        },
      },
    }),
    db.settings.findUnique({
      where: { tenantId },
      select: { encounterSpineSettings: true },
    }),
  ]);

  if (!encounter) return null;

  const tenant = await db.tenant.findFirst({
    where: { id: tenantId },
    select: { featureFlags: true },
  });

  const spineSettings = resolveEncounterSpineSettings({
    settingsJson: settings?.encounterSpineSettings as Record<string, unknown> | null,
    featureFlags: tenant?.featureFlags as Record<string, unknown> | null,
  });

  return {
    encounter,
    spineSettings,
    staleAfterMinutes: staleAfterMinutesFromSettings(spineSettings),
  };
}

export async function assertProcedureStartGatesAllowed(params: {
  tenantId: string;
  encounterId: string;
  procedureLineId: string;
}): Promise<void> {
  const loaded = await loadGateBundleForEncounter(params.tenantId, params.encounterId);
  if (!loaded) throw new Error("Encounter not found.");

  const { encounter } = loaded;
  const line = encounter.procedureLines.find((l) => l.id === params.procedureLineId);
  if (!line) throw new Error("Procedure line not found on encounter.");

  const gates = evaluateEncounterGates({
    risk: encounter.riskAssessments[0] ?? null,
    consent: encounter.consentRecords[0] ?? null,
    insurance: encounter.insuranceVerifications[0] ?? null,
    sterilizationLogs: [
      {
        procedureLineId: line.id,
        loggedAt: line.sterilizationLoggedAt,
      },
    ],
    preAuthOverridden: encounter.preAuthOverridden,
  });

  if (!gates.risk.cleared) {
    throw new Error(gates.risk.reason ?? "Risk assessment must be cleared first.");
  }
  if (!gates.consent?.cleared) {
    throw new Error(gates.consent?.reason ?? "Clinical consent is required.");
  }
  if (!gates.insurance?.cleared) {
    throw new Error(gates.insurance?.reason ?? "Insurance verification is required.");
  }
  const steril = gates.sterilization[0];
  if (steril && !steril.cleared) {
    throw new Error(steril.reason);
  }
}

/**
 * Map an evaluateEncounterGates() result to GateSummary.
 * Prefer summarizeGatesFromRecords for page/read paths.
 */
export function gateBundleToSummary(
  result: ReturnType<typeof evaluateEncounterGates>,
): GateSummary {
  const sterilAllClear =
    result.sterilization.length === 0
      ? "pending"
      : result.sterilization.every((s) => s.cleared)
        ? "cleared"
        : "blocked";

  return {
    risk: result.risk.cleared ? "cleared" : "blocked",
    consent: result.consent
      ? result.consent.cleared
        ? "cleared"
        : "blocked"
      : "pending",
    insurance: result.insurance
      ? result.insurance.cleared
        ? "cleared"
        : "blocked"
      : "pending",
    sterilization: sterilAllClear,
  };
}

/**
 * Live gate summary for spine UI. Empty/initial encounters return
 * blocked/pending statuses via summarizeGatesFromRecords — no catch-all:
 * load/DB failures still surface. Write-path asserts still throw on illegal ops.
 */
export async function buildLiveGateSummary(
  tenantId: string,
  encounterId: string,
): Promise<GateSummary> {
  const loaded = await loadGateBundleForEncounter(tenantId, encounterId);
  if (!loaded) return { ...UNKNOWN_GATES };

  const { encounter } = loaded;
  return summarizeGatesFromRecords({
    risk: encounter.riskAssessments[0] ?? null,
    consent: encounter.consentRecords[0] ?? null,
    insurance: encounter.insuranceVerifications[0] ?? null,
    sterilizationLogs: encounter.procedureLines.map((l) => ({
      procedureLineId: l.id,
      loggedAt: l.sterilizationLoggedAt,
    })),
    preAuthOverridden: encounter.preAuthOverridden,
  });
}

export async function applyPreAuthOverride(params: {
  tenantId: string;
  encounterId: string;
  userId: string;
  staffMemberId: string;
  role: UserRole;
  reason: string;
  patientAcknowledged: boolean;
}) {
  if (!params.patientAcknowledged) {
    throw new Error("Patient acknowledgment is required for a pre-auth SLA override.");
  }
  if (!canOverridePreAuth(params.role)) {
    throw new Error("You do not have permission to override pre-authorization.");
  }

  const encounter = await db.encounter.findFirst({
    where: { id: params.encounterId, tenantId: params.tenantId, deletedAt: null },
    include: { insuranceVerifications: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!encounter) throw new Error("Encounter not found.");

  const override = await overridePreAuthGate({
    tenantId: params.tenantId,
    userId: params.userId,
    role: params.role,
    encounterId: params.encounterId,
    insuranceVerificationId: encounter.insuranceVerifications[0]?.id,
    reason: params.reason,
  });
  if (!override.ok) throw new Error(override.error);

  const now = new Date();
  await db.encounter.update({
    where: { id: encounter.id },
    data: {
      preAuthOverridden: true,
      preAuthOverrideReason: params.reason.trim(),
      preAuthOverrideByStaffId: params.staffMemberId,
      patientAckPreAuthAt: now,
    },
  });

  await createAuditLog({
    tenantId: params.tenantId,
    userId: params.userId,
    action: AuditAction.PERMISSION_CHANGE,
    entity: "Encounter",
    entityId: encounter.id,
    metadata: {
      kind: "pre_auth_override_applied",
      reason: params.reason.trim(),
      patientAckAt: now.toISOString(),
    },
  });
}
