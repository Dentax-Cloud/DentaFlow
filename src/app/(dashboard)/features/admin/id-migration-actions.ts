"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { assignCodestoExistingTenant } from "@/lib/ids/generate-ids";

export async function getIdMigrationStatus() {
  const ctx = await requireTenantContext();

  const [tenant, branchCount, branchesWithCode, patientTotal, patientsWithId] =
    await Promise.all([
      db.tenant.findUnique({
        where: { id: ctx.tenantId },
        select: { tenantCode: true, globalTenantId: true, countryCode: true },
      }),
      db.branch.count({ where: { tenantId: ctx.tenantId } }),
      db.branch.count({ where: { tenantId: ctx.tenantId, branchCode: { not: null } } }),
      db.patient.count({ where: { tenantId: ctx.tenantId, deletedAt: null } }),
      db.patient.count({
        where: { tenantId: ctx.tenantId, deletedAt: null, patientId: { not: null } },
      }),
    ]);

  return {
    tenantCode: tenant?.tenantCode ?? null,
    globalTenantId: tenant?.globalTenantId ?? null,
    countryCode: tenant?.countryCode ?? "AE",
    branchesTotal: branchCount,
    branchesWithCode,
    patientsTotal: patientTotal,
    patientsWithId,
    patientsPending: patientTotal - patientsWithId,
  };
}

export async function runIdMigration() {
  const ctx = await requireTenantContext();
  if (ctx.staffMember?.role !== "OWNER" && !ctx.isSuperAdmin) {
    throw new Error("Only clinic owners can run ID migration");
  }
  return assignCodestoExistingTenant(ctx.tenantId);
}
