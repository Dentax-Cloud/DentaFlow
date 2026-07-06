/**
 * One-time migration: Patient.insurance* fields → PatientInsurancePolicy (PRIMARY).
 * Non-destructive — legacy Patient columns are left intact.
 *
 * Scans ALL tenants in a single run (no tenantId filter).
 * New tenants provisioned via provisionTenant() have no legacy patient insurance
 * fields, so this backfill is only needed for imported/migrated data.
 *
 * Run: pnpm db:migrate-insurance
 */
import { PrismaClient } from "@prisma/client";
import { getCountryProfile } from "../../src/lib/countries";

const db = new PrismaClient();

async function legacyGapByTenant() {
  const rows = await db.$queryRaw<
    Array<{ tenantId: string; name: string; legacy_without_policy: bigint }>
  >`
    SELECT p."tenantId", t.name, COUNT(*) AS legacy_without_policy
    FROM "Patient" p
    JOIN "Tenant" t ON t.id = p."tenantId"
    WHERE p."insuranceProvider" IS NOT NULL
      AND p."insuranceProvider" <> 'SELF_PAY'
      AND p."deletedAt" IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM "PatientInsurancePolicy" pip
        WHERE pip."patientId" = p.id AND pip."tenantId" = p."tenantId"
      )
    GROUP BY p."tenantId", t.name
    ORDER BY legacy_without_policy DESC
  `;
  return rows.map((r) => ({
    tenantId: r.tenantId,
    name: r.name,
    legacyWithoutPolicy: Number(r.legacy_without_policy),
  }));
}

async function main() {
  const gapBefore = await legacyGapByTenant();
  console.log("Gap before backfill (legacy patients without policy):");
  console.log(JSON.stringify(gapBefore, null, 2));
  console.log(
    `Total gap: ${gapBefore.reduce((sum, row) => sum + row.legacyWithoutPolicy, 0)}`,
  );

  const patients = await db.patient.findMany({
    where: {
      deletedAt: null,
      insuranceProvider: { not: null },
      NOT: { insuranceProvider: "SELF_PAY" },
    },
    select: {
      id: true,
      tenantId: true,
      insuranceProvider: true,
      insuranceNetwork: true,
      insuranceMemberId: true,
      insurancePolicyNo: true,
      insuranceExpiry: true,
    },
  });

  let created = 0;
  let skipped = 0;
  let missingMemberId = 0;
  const perTenantCreated: Record<string, number> = {};

  for (const patient of patients) {
    const existing = await db.patientInsurancePolicy.findFirst({
      where: {
        tenantId: patient.tenantId,
        patientId: patient.id,
        rank: "PRIMARY",
        isActive: true,
      },
    });
    if (existing) {
      skipped++;
      continue;
    }

    const providerCode = patient.insuranceProvider!;
    const tenantProvider = await db.tenantInsuranceProvider.findFirst({
      where: { tenantId: patient.tenantId, code: providerCode, isActive: true },
    });

    const tenant = await db.tenant.findUnique({
      where: { id: patient.tenantId },
      select: { countryCode: true },
    });
    const profile = getCountryProfile(tenant?.countryCode ?? "AE");
    const platformProvider = profile.insuranceProviders.find((p) => p.code === providerCode);

    const memberId = patient.insuranceMemberId?.trim() || "";
    if (!memberId) missingMemberId++;

    await db.patientInsurancePolicy.create({
      data: {
        tenantId: patient.tenantId,
        patientId: patient.id,
        rank: "PRIMARY",
        providerId: tenantProvider?.id ?? null,
        providerNameFreeText:
          tenantProvider?.name ?? platformProvider?.name ?? providerCode,
        networkTier: patient.insuranceNetwork,
        memberId: memberId || "UNKNOWN",
        groupNumber: patient.insurancePolicyNo,
        expiryDate: patient.insuranceExpiry,
        verificationStatus: "NOT_VERIFIED",
        subscriberRelationship: "SELF",
      },
    });
    created++;
    perTenantCreated[patient.tenantId] = (perTenantCreated[patient.tenantId] ?? 0) + 1;
  }

  const gapAfter = await legacyGapByTenant();

  console.log(
    JSON.stringify(
      {
        patientsScanned: patients.length,
        policiesCreated: created,
        skippedExistingPrimary: skipped,
        missingMemberId,
        perTenantCreated,
        gapAfter,
        totalGapAfter: gapAfter.reduce((sum, row) => sum + row.legacyWithoutPolicy, 0),
        note:
          missingMemberId > 0
            ? "Some patients had no insuranceMemberId — memberId set to UNKNOWN"
            : undefined,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
