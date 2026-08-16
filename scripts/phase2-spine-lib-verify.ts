/**
 * Programmatic spine write-path + billing verification (flag-on libs).
 * Complements Playwright UI routing checks.
 */
import { PrismaClient, Prisma, UserRole } from "@prisma/client";
import { createEncounterFromAppointment, transitionEncounterStatus } from "../src/lib/encounter/lifecycle";
import {
  addEncounterProcedureLine,
  transitionProcedureLineStatus,
  logSterilizationForLine,
  logMaterialUsage,
} from "../src/lib/encounter/procedure-execution";
import {
  createRiskAssessmentAudited,
  createConsentRecordAudited,
  createInsuranceVerificationAudited,
} from "../src/lib/encounter/repository";
import {
  closeAndInvoiceEncounter,
  EncounterDoubleInvoiceError,
  assertEncounterCanInvoice,
} from "../src/lib/encounter/billing";
import { advanceToProcedureExecutionIfReady } from "../src/lib/encounter/billing";
import fs from "node:fs";

const db = new PrismaClient();
const APPT = "seed_appt_spine_phase2";
const TENANT = "tenant_a";
const OUT = "tmp-phase2-clicktest";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const staff = await db.staffMember.findFirst({
    where: { tenantId: TENANT, email: "owner@brightsmile.demo" },
  });
  const userId = staff?.id;

  // Reset any prior encounter on this appointment
  await db.invoice.updateMany({
    where: { tenantId: TENANT, encounterId: { not: null } },
    data: { encounterId: null, deletedAt: new Date() },
  });
  await db.encounter.updateMany({
    where: { appointmentId: APPT, tenantId: TENANT },
    data: { deletedAt: new Date(), closedAt: new Date() },
  });

  const encounter = await createEncounterFromAppointment({
    tenantId: TENANT,
    appointmentId: APPT,
    userId,
    staffMemberId: staff?.id,
    walkIn: true,
  });

  await transitionEncounterStatus({
    tenantId: TENANT,
    encounterId: encounter.id,
    toStatus: "chief_complaint_exam",
    userId,
    staffMemberId: staff?.id,
  });
  if (!staff?.id) throw new Error("Expected clinical staff for examination.");
  await db.encounter.update({
    where: { id: encounter.id },
    data: {
      examCompletedAt: new Date(),
      examinedByStaffId: staff.id,
      examClinicalNoteId: "phase2-lib-verify-exam",
    },
  });
  await transitionEncounterStatus({
    tenantId: TENANT,
    encounterId: encounter.id,
    toStatus: "gates",
    userId,
    staffMemberId: staff?.id,
  });

  await createRiskAssessmentAudited(
    {
      tenant: { connect: { id: TENANT } },
      encounter: { connect: { id: encounter.id } },
      asaClass: "II",
      clearedAt: new Date(),
      ...(staff?.id
        ? { clearedByStaff: { connect: { id: staff.id } } }
        : {}),
    },
    { tenantId: TENANT, userId },
  );
  await createConsentRecordAudited(
    {
      tenant: { connect: { id: TENANT } },
      encounter: { connect: { id: encounter.id } },
      purpose: "clinical",
      grantedAt: new Date(),
    },
    { tenantId: TENANT, userId },
  );
  await createInsuranceVerificationAudited(
    {
      tenant: { connect: { id: TENANT } },
      encounter: { connect: { id: encounter.id } },
      eligibilityStatus: "eligible",
      preAuthStatus: "not_required",
      verifiedAt: new Date(),
      staleAfterMinutes: 1440,
      estimatedCoverage: new Prisma.Decimal(0),
      estimatedCopay: new Prisma.Decimal(0),
    },
    { tenantId: TENANT, userId },
  );

  await advanceToProcedureExecutionIfReady({
    tenantId: TENANT,
    encounterId: encounter.id,
    userId,
    staffMemberId: staff?.id,
  });

  const catalog = await db.procedureCatalog.findFirst({
    where: { tenantId: TENANT, code: "D2391" },
  });
  if (!catalog) throw new Error("Missing procedure D2391");

  const line = await addEncounterProcedureLine({
    tenantId: TENANT,
    encounterId: encounter.id,
    procedureCatalogId: catalog.id,
    plannedVsPerformed: "added",
    providerId: staff?.id,
    userId,
  });
  await logSterilizationForLine({ tenantId: TENANT, lineId: line.id, userId });
  await transitionProcedureLineStatus({
    tenantId: TENANT,
    lineId: line.id,
    toStatus: "in_progress",
    providerId: staff?.id,
    userId,
  });
  await transitionProcedureLineStatus({
    tenantId: TENANT,
    lineId: line.id,
    toStatus: "completed",
    providerId: staff?.id,
    userId,
  });
  await logMaterialUsage({
    tenantId: TENANT,
    procedureLineId: line.id,
    itemId: "inv_spine_composite",
    tier: "consumable",
    quantity: 2,
    userId,
  });

  await transitionEncounterStatus({
    tenantId: TENANT,
    encounterId: encounter.id,
    toStatus: "close_out",
    userId,
    staffMemberId: staff?.id,
  });
  await transitionEncounterStatus({
    tenantId: TENANT,
    encounterId: encounter.id,
    toStatus: "billing",
    userId,
    staffMemberId: staff?.id,
  });

  const invoice = await closeAndInvoiceEncounter({
    tenantId: TENANT,
    encounterId: encounter.id,
    userId,
    staffMemberId: staff?.id,
    closedReason: "manual_close_bill",
  });

  let doubleReject = "not-run";
  try {
    await assertEncounterCanInvoice(TENANT, encounter.id);
    doubleReject = "UNEXPECTED-PASS";
  } catch (e) {
    doubleReject =
      e instanceof EncounterDoubleInvoiceError
        ? `ok:${e.message}`
        : `other:${e instanceof Error ? e.message : String(e)}`;
  }

  let concurrentReject = "not-run";
  try {
    await closeAndInvoiceEncounter({
      tenantId: TENANT,
      encounterId: encounter.id,
      userId,
      staffMemberId: staff?.id,
    });
    concurrentReject = "UNEXPECTED-SECOND-INVOICE";
  } catch (e) {
    concurrentReject =
      e instanceof EncounterDoubleInvoiceError
        ? `ok:${e.message}`
        : `other:${e instanceof Error ? e.message : String(e)}`;
  }

  const full = await db.invoice.findUnique({
    where: { id: invoice.id },
    include: { items: true },
  });

  const report = {
    encounterId: encounter.id,
    invoice: full
      ? {
          id: full.id,
          number: full.invoiceNumber,
          encounterId: full.encounterId,
          subtotal: full.subtotal.toString(),
          tax: full.tax.toString(),
          total: full.total.toString(),
          items: full.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice.toString(),
            total: i.total.toString(),
            procedureCode: i.procedureCode,
            itemType: i.itemType,
          })),
        }
      : null,
    doubleReject,
    concurrentReject,
    roleCheckUnused: UserRole.OWNER,
  };
  fs.writeFileSync(`${OUT}/lib-spine-billing.json`, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
