import { db } from "@/lib/db";

export type ConsentGateResult =
  | { ok: true }
  | { ok: false; message: string; missingPlans: string[] };

/**
 * Block chairside entry when consent-required procedures are on an active plan
 * without patient acceptance (portal share acceptedAt).
 */
export async function checkConsentForVisit(
  tenantId: string,
  patientId: string,
): Promise<ConsentGateResult> {
  const plans = await db.treatmentPlan.findMany({
    where: {
      tenantId,
      patientId,
      deletedAt: null,
      status: { in: ["PROPOSED", "ACCEPTED", "IN_PROGRESS"] },
    },
    include: {
      shares: { orderBy: { createdAt: "desc" }, take: 1 },
      items: { select: { procedureCatalogId: true, procedureCode: true } },
    },
  });

  const missingPlans: string[] = [];

  for (const plan of plans) {
    const catalogIds = plan.items
      .map((i) => i.procedureCatalogId)
      .filter((id): id is string => Boolean(id));
    const codes = plan.items
      .map((i) => i.procedureCode)
      .filter((c): c is string => Boolean(c));

    if (catalogIds.length === 0 && codes.length === 0) continue;

    const consentRequired = await db.procedureCatalog.findFirst({
      where: {
        tenantId,
        requiresConsent: true,
        OR: [
          ...(catalogIds.length ? [{ id: { in: catalogIds } }] : []),
          ...(codes.length ? [{ code: { in: codes } }] : []),
        ],
      },
    });
    if (!consentRequired) continue;

    const consented = plan.acceptedAt ?? plan.shares[0]?.acceptedAt;
    if (!consented) {
      missingPlans.push(plan.title);
    }
  }

  if (missingPlans.length > 0) {
    return {
      ok: false,
      message:
        `Patient consent is required before treatment. Unsigned plan(s): ${missingPlans.join(", ")}. ` +
        "Ask the patient to sign via the portal or obtain written consent.",
      missingPlans,
    };
  }

  return { ok: true };
}

export async function assertConsentForVisit(tenantId: string, patientId: string): Promise<void> {
  const result = await checkConsentForVisit(tenantId, patientId);
  if (!result.ok) {
    throw new Error(result.message);
  }
}
