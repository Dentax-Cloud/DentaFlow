import { db } from "@/lib/db";
import { isPreAuthDefaultRequired } from "@/lib/countries";
import { patientHasActiveInsurance } from "@/lib/billing/insurance-calculator";
import { isPreAuthApproved } from "@/lib/insurance/estimate-types";

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

export async function assertCanStartTreatment(
  tenantId: string,
  planId: string,
  countryCode: string,
): Promise<void> {
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
