/**
 * One-time migration: Patient.insurance* fields → PatientInsurancePolicy (PRIMARY).
 * Non-destructive — legacy Patient columns are left intact.
 *
 * Run: pnpm db:migrate-insurance
 */
import { PrismaClient } from "@prisma/client";
import { getCountryProfile } from "../../src/lib/countries";

const db = new PrismaClient();

async function main() {
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
  }

  console.log(
    JSON.stringify(
      {
        patientsScanned: patients.length,
        policiesCreated: created,
        skippedExistingPrimary: skipped,
        missingMemberId,
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
