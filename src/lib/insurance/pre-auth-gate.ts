import { PolicyRank } from "@prisma/client";
import { db } from "@/lib/db";
import { patientHasActiveInsurance } from "@/lib/billing/insurance-calculator";
import { isPreAuthApproved } from "@/lib/insurance/estimate-types";
import { resolveProcedure } from "@/lib/procedures/procedure-resolver";

export { isPreAuthApproved };

export async function getPlanPreAuthorization(tenantId: string, treatmentPlanId: string) {
  return db.preAuthorization.findFirst({
    where: {
      tenantId,
      estimate: { treatmentPlanId },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function findApprovedPreAuthorizationForPolicy(policyId: string) {
  return db.preAuthorization.findFirst({
    where: {
      policyId,
      status: { in: ["APPROVED", "PARTIALLY_APPROVED"] },
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
      approvedInsurerAmount: { not: null },
      approvedPatientAmount: { not: null },
    },
    orderBy: { decisionAt: "desc" },
  });
}

export async function patientHasApprovedPreAuthorization(
  tenantId: string,
  patientId: string,
): Promise<boolean> {
  const policy = await db.patientInsurancePolicy.findFirst({
    where: {
      tenantId,
      patientId,
      rank: PolicyRank.PRIMARY,
      isActive: true,
    },
    select: { id: true },
  });
  if (!policy) return false;

  const preAuth = await findApprovedPreAuthorizationForPolicy(policy.id);
  return Boolean(preAuth && isPreAuthApproved(preAuth.status));
}

export async function procedureCodeRequiresPreAuth(
  tenantId: string,
  procedureCode: string | null,
): Promise<boolean> {
  if (!procedureCode?.trim()) return false;

  const catalog = await db.procedureCatalog.findFirst({
    where: { tenantId, code: procedureCode.trim(), isActive: true },
    select: { id: true, requiresPreAuth: true },
  });
  if (!catalog) return false;

  const resolved = await resolveProcedure(catalog.id, tenantId);
  return resolved?.requiresPreAuth ?? catalog.requiresPreAuth;
}

export type ProcedureLinePreAuthEvaluation = {
  requiresPreAuth: boolean;
  preAuthStatus: string | null;
  showWarning: boolean;
  warningMessage: string | null;
};

export const PRE_AUTH_WARNING_MESSAGE =
  "This procedure typically requires pre-authorization, which is not yet approved for this patient. Billing may need to follow up before invoicing.";

export async function evaluateProcedureLinePreAuthClose(params: {
  tenantId: string;
  patientId: string;
  procedureCode: string | null;
}): Promise<ProcedureLinePreAuthEvaluation> {
  const requiresPreAuth = await procedureCodeRequiresPreAuth(
    params.tenantId,
    params.procedureCode,
  );

  if (!requiresPreAuth) {
    return {
      requiresPreAuth: false,
      preAuthStatus: "NOT_REQUIRED",
      showWarning: false,
      warningMessage: null,
    };
  }

  const hasInsurance = await patientHasActiveInsurance(params.tenantId, params.patientId);
  if (!hasInsurance) {
    return {
      requiresPreAuth: true,
      preAuthStatus: "NOT_REQUIRED",
      showWarning: false,
      warningMessage: null,
    };
  }

  const hasApproval = await patientHasApprovedPreAuthorization(
    params.tenantId,
    params.patientId,
  );

  if (hasApproval) {
    return {
      requiresPreAuth: true,
      preAuthStatus: "APPROVED",
      showWarning: false,
      warningMessage: null,
    };
  }

  return {
    requiresPreAuth: true,
    preAuthStatus: "MISSING",
    showWarning: true,
    warningMessage: PRE_AUTH_WARNING_MESSAGE,
  };
}

export async function assertCanStartTreatment(
  tenantId: string,
  planId: string,
  countryCode: string,
): Promise<void> {
  const { isPreAuthDefaultRequired } = await import("@/lib/countries");
  if (!isPreAuthDefaultRequired(countryCode)) return;

  const plan = await db.treatmentPlan.findFirst({
    where: { id: planId, tenantId, deletedAt: null },
    select: { patientId: true },
  });
  if (!plan) throw new Error("Plan not found");

  const hasInsurance = await patientHasActiveInsurance(tenantId, plan.patientId);
  if (!hasInsurance) return;

  const preAuth = await getPlanPreAuthorization(tenantId, planId);
  if (!preAuth || !isPreAuthApproved(preAuth.status)) {
    throw new Error(
      "Pre-authorization approval is required before starting treatment in your region.",
    );
  }
}
