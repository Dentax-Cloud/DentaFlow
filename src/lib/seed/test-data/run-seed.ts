/**
 * Comprehensive test-data seed orchestrator.
 *
 * SAFETY: Not wired into prisma/seed.ts or container boot.
 * Re-run without --force skips if test-* tenants exist.
 * Re-run with --force deletes all test-* tenants + @test.dentaflow.io auth users first.
 */

import { randomUUID } from "crypto";
import { hash } from "bcryptjs";
import {
  AppointmentStatus,
  InvoiceStatus,
  PolicyRank,
  PreAuthStatus,
  SubscriberRelationship,
  UserRole,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { seedGPMR, verifySeed } from "@/lib/procedures/run-gpmr-seed";
import { provisionTenant } from "@/lib/tenant/service";
import { getCountryProfile, getInsuranceProviders } from "@/lib/countries";
import { generatePatientId, generateBranchCode, generateInvoiceRef, getCityCode } from "@/lib/ids/generate-ids";
import { generateInvoiceNumber } from "@/lib/utils";
import { calculateInsuranceSplit } from "@/lib/billing/insurance-calculator";
import { CHAIRSIDE_SESSION_STATUS } from "@/lib/clinical/chairside-lifecycle";
import {
  TEST_CLINICS,
  TEST_PASSWORD,
  TEST_SLUG_PREFIX,
  type TestClinicDef,
} from "./catalog";
import {
  addDays,
  addMinutes,
  createRng,
  daysFromNow,
  identityDocForCountry,
  ownerEmailForSlug,
  pickInt,
  randomPersonName,
  staffEmailForSlug,
} from "./helpers";
import { importGpmrForTenant, priceAllProceduresForTenant } from "./gpmr-import";

export type SeedSummary = {
  tenants: number;
  byCountry: Record<string, number>;
  patients: number;
  staff: number;
  appointments: number;
  chairs: number;
  inventoryItems: number;
  treatmentPlans: number;
  estimates: number;
  preAuths: number;
  chairsideSessions: number;
  ownerLogins: Array<{ slug: string; email: string; country: string; plan: string }>;
  chairsideOrphanSessionId?: string;
  chairsideActiveSessionId?: string;
};

type TenantSeedResult = {
  tenantId: string;
  slug: string;
  countryCode: string;
  plan: string;
  ownerEmail: string;
  patientIds: string[];
  doctorStaffIds: string[];
  branchId: string;
  chairIds: string[];
  procedureIds: string[];
};

const VERIFICATION_STATUSES = [
  "VERIFIED",
  "PENDING",
  "NOT_VERIFIED",
  "EXPIRED",
] as const;

const INVENTORY_TEMPLATES = [
  { sku: "TD-GLOVES", name: "Nitrile Gloves (Box)", category: "CONSUMABLE", unit: "BOX", baseQty: 25 },
  { sku: "TD-MASKS", name: "Surgical Masks (Box)", category: "CONSUMABLE", unit: "BOX", baseQty: 20 },
  { sku: "TD-ANESTH", name: "Lidocaine Cartridges", category: "CONSUMABLE", unit: "PCS", baseQty: 80 },
  { sku: "TD-COMP", name: "Composite Resin A2", category: "CONSUMABLE", unit: "SYRINGE", baseQty: 15 },
  { sku: "TD-BOND", name: "Dental Bonding Agent", category: "CONSUMABLE", unit: "BOTTLE", baseQty: 8 },
  { sku: "TD-GAUZE", name: "Sterile Gauze Packs", category: "CONSUMABLE", unit: "PACK", baseQty: 40 },
  { sku: "TD-AMOX", name: "Amoxicillin 500mg", category: "MEDICINE", unit: "BOX", baseQty: 12 },
  { sku: "TD-IBU", name: "Ibuprofen 400mg", category: "MEDICINE", unit: "BOX", baseQty: 18 },
  { sku: "TD-PARAC", name: "Paracetamol 500mg", category: "MEDICINE", unit: "BOX", baseQty: 22 },
  { sku: "TD-CHLOR", name: "Chlorhexidine Mouthwash", category: "MEDICINE", unit: "BOTTLE", baseQty: 10 },
  { sku: "TD-ETCH", name: "Phosphoric Acid Etchant", category: "CONSUMABLE", unit: "BOTTLE", baseQty: 6 },
  { sku: "TD-IMP", name: "Impression Material", category: "CONSUMABLE", unit: "CARTRIDGE", baseQty: 9 },
  { sku: "TD-FLOSS", name: "Dental Floss (Patient Packs)", category: "CONSUMABLE", unit: "PACK", baseQty: 30 },
  { sku: "TD-TEMP", name: "Temporary Filling Material", category: "CONSUMABLE", unit: "TUBE", baseQty: 7 },
  { sku: "TD-SEAL", name: "Pit & Fissure Sealant", category: "CONSUMABLE", unit: "SYRINGE", baseQty: 5 },
];

let globalChairsideOrphanId: string | undefined;
let globalChairsideActiveId: string | undefined;
let globalChairsideCount = 0;

async function hashPassword(plain: string) {
  return hash(plain, 12);
}

function logStep(step: string, detail?: string) {
  const suffix = detail ? ` — ${detail}` : "";
  console.log(`\n▶ ${step}${suffix}`);
}

export async function testDataExists(): Promise<boolean> {
  const count = await db.tenant.count({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
  });
  return count > 0;
}

export async function purgeTestData(): Promise<void> {
  logStep("PURGE", "Removing existing test-* tenants and auth users");
  const tenants = await db.tenant.findMany({
    where: { slug: { startsWith: TEST_SLUG_PREFIX } },
    select: { id: true },
  });
  if (tenants.length === 0) {
    console.log("  (no test tenants found)");
    return;
  }
  await db.tenant.deleteMany({
    where: { id: { in: tenants.map((t) => t.id) } },
  });
  await db.auth_users.deleteMany({
    where: { email: { endsWith: "@test.dentaflow.io" } },
  });
  console.log(`  Deleted ${tenants.length} test tenant(s)`);
}

async function ensureGpmr(): Promise<void> {
  logStep("STEP 1", "Ensure GPMR global library seeded");
  const before = await verifySeed();
  if (before.totalProcedures === 0) {
    const result = await seedGPMR();
    console.log(
      `  GPMR seeded: ${result.procedures.created} procedures, ${result.countryPacks.created} packs`,
    );
  } else {
    console.log(`  GPMR already present (${before.totalProcedures} procedures)`);
    await seedGPMR();
  }
  const after = await verifySeed();
  console.log(
    `  Verified: ${after.totalProcedures} procedures, ${after.totalCountryPacks} country packs`,
  );
}

async function ensureAuthUser(
  email: string,
  name: string,
): Promise<string> {
  const passwordHash = await hashPassword(TEST_PASSWORD);
  const user = await db.auth_users.upsert({
    where: { email },
    update: { passwordHash, name, emailVerified: new Date() },
    create: {
      id: `auth_${randomUUID().slice(0, 12)}`,
      email,
      name,
      passwordHash,
      emailVerified: new Date(),
    },
  });
  return user.id;
}

async function seedInsuranceProviders(
  tenantId: string,
  countryCode: string,
): Promise<void> {
  const providers = getInsuranceProviders(countryCode).slice(0, 3);
  for (const [i, p] of providers.entries()) {
    await db.tenantInsuranceProvider.upsert({
      where: { tenantId_code: { tenantId, code: p.code } },
      update: {
        name: p.name,
        nameAr: p.nameAr ?? null,
        shortName: p.shortName,
        isCustom: false,
        isActive: true,
        requiresPreAuth: p.requiresPreAuth,
        networkTypes: p.networkTypes as Prisma.InputJsonValue,
        sortOrder: i,
      },
      create: {
        tenantId,
        countryCode,
        code: p.code,
        name: p.name,
        nameAr: p.nameAr ?? null,
        shortName: p.shortName,
        isCustom: false,
        isActive: true,
        requiresPreAuth: p.requiresPreAuth,
        networkTypes: p.networkTypes as Prisma.InputJsonValue,
        sortOrder: i,
      },
    });
  }
}

async function seedTenant(clinic: TestClinicDef, index: number): Promise<TenantSeedResult> {
  const rng = createRng(1000 + index);
  const ownerEmail = ownerEmailForSlug(clinic.slug);
  const ownerName = randomPersonName(rng, clinic.countryCode);
  const ownerFullName = `Dr. ${ownerName.firstName} ${ownerName.lastName}`;
  const ownerAuthId = await ensureAuthUser(ownerEmail, ownerFullName);

  const profile = getCountryProfile(clinic.countryCode);

  const provisioned = await provisionTenant({
    ownerAuthUserId: ownerAuthId,
    ownerName: ownerFullName,
    ownerEmail,
    clinicName: clinic.name,
    clinicEmail: ownerEmail,
    phone: profile.phoneExample,
    address: `${clinic.city} Main Street`,
    timezone: clinic.timezone,
    countryCode: clinic.countryCode,
  });

  const tenantId = provisioned.tenant.id;

  await db.tenant.update({
    where: { id: tenantId },
    data: {
      slug: clinic.slug,
      name: clinic.name,
      city: clinic.city,
      country: clinic.countryCode,
      subscriptionPlan: clinic.plan,
      subscriptionStatus: clinic.subscriptionStatus,
      trialEndsAt:
        clinic.subscriptionStatus === "TRIALING"
          ? addDays(new Date(), 14)
          : null,
      onboardingCompleted: true,
      currency: profile.currency,
      currencySymbol: profile.currencySymbol,
    },
  });

  await db.procedureCatalog.deleteMany({ where: { tenantId, gpmrId: null } });
  await db.inventoryItem.deleteMany({ where: { tenantId } });

  let branchId = provisioned.branch.id;

  if (clinic.extraBranch) {
    const secondBranch = await db.branch.create({
      data: {
        tenantId,
        name: `${clinic.city} Branch 2`,
        address: `${clinic.city} Secondary Road`,
        phone: profile.phoneExample,
        isPrimary: false,
      },
    });
    const cityCode = getCityCode(clinic.city);
    const { branchCode, branchSeq } = await generateBranchCode(tenantId, cityCode);
    await db.branch.update({
      where: { id: secondBranch.id },
      data: { branchCode, cityCode, branchSeq },
    });
    branchId = provisioned.branch.id;
  }

  await seedInsuranceProviders(tenantId, clinic.countryCode);

  const gpmrImport = await importGpmrForTenant(tenantId, clinic.countryCode);
  const priced = await priceAllProceduresForTenant(tenantId, clinic.countryCode, rng);
  console.log(
    `  ${clinic.slug}: GPMR ${gpmrImport.imported} imported, ${priced} priced`,
  );

  const procedures = await db.procedureCatalog.findMany({
    where: { tenantId, isActive: true },
    select: { id: true, code: true, name: true, price: true, category: true },
  });

  const staffIds: string[] = [provisioned.staffMember.id];
  const doctorStaffIds: string[] = [];

  const staffRoles: Array<{ role: UserRole; count: number }> =
    clinic.plan === "STARTER"
      ? [
          { role: UserRole.ADMIN, count: 1 },
          { role: UserRole.DOCTOR, count: 1 },
          { role: UserRole.RECEPTIONIST, count: 1 },
        ]
      : [
          { role: UserRole.ADMIN, count: 1 },
          { role: UserRole.DOCTOR, count: pickInt(rng, 1, 3) },
          { role: UserRole.NURSE, count: pickInt(rng, 1, 3) },
          { role: UserRole.RECEPTIONIST, count: 1 },
          { role: UserRole.STORE, count: 1 },
        ];

  for (const { role, count } of staffRoles) {
    for (let i = 0; i < count; i++) {
      const person = randomPersonName(rng, clinic.countryCode);
      const email = staffEmailForSlug(clinic.slug, role, i);
      const authId = await ensureAuthUser(
        email,
        `${person.firstName} ${person.lastName}`,
      );
      await db.tenant_memberships.upsert({
        where: {
          userId_tenantId: { userId: authId, tenantId },
        },
        update: { role: role === UserRole.ADMIN ? "ADMIN" : role },
        create: {
          id: randomUUID(),
          userId: authId,
          tenantId,
          role: role === UserRole.DOCTOR ? "DOCTOR" : role,
        },
      });
      const staff = await db.staffMember.create({
        data: {
          tenantId,
          authUserId: authId,
          email,
          firstName: person.firstName,
          lastName: person.lastName,
          role,
          isActive: true,
        },
      });
      staffIds.push(staff.id);
      if (role === UserRole.DOCTOR) {
        doctorStaffIds.push(staff.id);
        await db.doctor.create({
          data: {
            tenantId,
            userId: staff.id,
            specialty: "General Dentistry",
            color: "#0ea5e9",
          },
        });
      }
    }
  }

  const chairCount = pickInt(rng, 1, 5);
  const chairIds: string[] = [];
  for (let c = 1; c <= chairCount; c++) {
    const doctorId =
      doctorStaffIds.length > 0
        ? doctorStaffIds[(c - 1) % doctorStaffIds.length]
        : null;
    const doctor = doctorId
      ? await db.doctor.findUnique({ where: { userId: doctorId } })
      : null;
    const chair = await db.chair.create({
      data: {
        tenantId,
        branchId,
        name: `Chair ${c}`,
        number: c,
        doctorId: doctor?.id ?? null,
        chairType: c === 1 ? "GENERAL" : "HYGIENE",
        roomName: `Operatory ${c}`,
        isActive: true,
      },
    });
    chairIds.push(chair.id);
  }

  const patientIds: string[] = [];
  const verificationSpread = [...VERIFICATION_STATUSES];

  for (let p = 0; p < 10; p++) {
    const person = randomPersonName(rng, clinic.countryCode);
    const idDoc = identityDocForCountry(clinic.countryCode, index * 100 + p);
    const { patientId, patientSeq, branchCode } = await generatePatientId(branchId);

    const patient = await db.patient.create({
      data: {
        tenantId,
        patientNumber: `P-${String(p + 1).padStart(4, "0")}`,
        patientId,
        branchSeq: patientSeq,
        branchCode,
        firstName: person.firstName,
        lastName: person.lastName,
        email: `${person.firstName.toLowerCase()}.${person.lastName.toLowerCase().replace(/\s/g, "")}@example.com`,
        phone: profile.phoneExample,
        dateOfBirth: addDays(new Date(), -(25 * 365 + p * 400)),
        gender: p % 2 === 0 ? "FEMALE" : "MALE",
        address: `${10 + p} ${clinic.city} Street`,
        city: clinic.city,
        countryCode: clinic.countryCode,
        idDocumentType: idDoc.type,
        idDocumentNumber: idDoc.number,
        nationality: clinic.countryCode,
      },
    });
    patientIds.push(patient.id);

    const insurancePattern = p < 3 ? "SELF" : p < 8 ? "PRIMARY" : "COB";
    const providers = await db.tenantInsuranceProvider.findMany({
      where: { tenantId, isActive: true },
      take: 2,
    });

    if (insurancePattern === "PRIMARY" || insurancePattern === "COB") {
      const provider = providers[0];
      const networkTypes = (provider?.networkTypes ?? []) as Array<{
        code: string;
        name: string;
        defaultCoPayPercent?: number;
      }>;
      const network = networkTypes[0];
      const status = verificationSpread[p % verificationSpread.length]!;

      await db.patientInsurancePolicy.create({
        data: {
          tenantId,
          patientId: patient.id,
          rank: PolicyRank.PRIMARY,
          providerId: provider?.id ?? null,
          providerNameFreeText: provider?.name ?? "Insurance",
          networkTier: network?.code ?? "STANDARD",
          memberId: `MEM-${clinic.slug.slice(-4)}-${p}`,
          groupNumber: `GRP-${1000 + p}`,
          subscriberName: `${person.firstName} ${person.lastName}`,
          subscriberRelationship: SubscriberRelationship.SELF,
          effectiveDate: addDays(new Date(), -180),
          expiryDate: status === "EXPIRED" ? addDays(new Date(), -30) : addDays(new Date(), 365),
          verificationStatus: status,
          verifiedAt: status === "VERIFIED" ? addDays(new Date(), -7) : null,
          isActive: true,
        },
      });

      if (insurancePattern === "COB" && providers[1]) {
        const secNetwork = (
          (providers[1].networkTypes ?? []) as Array<{ code: string }>
        )[0];
        await db.patientInsurancePolicy.create({
          data: {
            tenantId,
            patientId: patient.id,
            rank: PolicyRank.SECONDARY,
            providerId: providers[1].id,
            providerNameFreeText: providers[1].name,
            networkTier: secNetwork?.code ?? "BASIC",
            memberId: `SEC-${clinic.slug.slice(-4)}-${p}`,
            groupNumber: `GRP2-${2000 + p}`,
            subscriberName: `${person.firstName} ${person.lastName}`,
            subscriberRelationship: SubscriberRelationship.SELF,
            effectiveDate: addDays(new Date(), -90),
            expiryDate: addDays(new Date(), 300),
            verificationStatus: "VERIFIED",
            verifiedAt: addDays(new Date(), -3),
            isActive: true,
          },
        });
      }
    }
  }

  const itemCount = pickInt(rng, 8, 15);
  const templates = INVENTORY_TEMPLATES.slice(0, itemCount);
  for (const [i, tmpl] of templates.entries()) {
    const isLowStock = i < 2;
    const isNearExpiry = i < 3;
    await db.inventoryItem.create({
      data: {
        tenantId,
        sku: `${tmpl.sku}-${clinic.slug.slice(-6)}`,
        name: tmpl.name,
        category: tmpl.category,
        unit: tmpl.unit,
        quantity: isLowStock ? 2 : tmpl.baseQty + pickInt(rng, 0, 10),
        reorderLevel: 10,
        cost: 10 + pickInt(rng, 5, 50),
        expiryDate: isNearExpiry
          ? addDays(new Date(), pickInt(rng, 5, 28))
          : addDays(new Date(), 180 + pickInt(rng, 30, 365)),
        trackByExpiry: true,
        minStockAlert: 5,
      },
    });
  }

  let appointmentCount = 0;
  let canceledLeft = index === 0 ? 1 : 0;
  let noShowLeft = index === 1 ? 1 : 0;

  for (let dayOffset = -7; dayOffset <= 2; dayOffset++) {
    const apptsToday = pickInt(rng, 1, 3);
    for (let a = 0; a < apptsToday; a++) {
      const patientId = patientIds[(a + dayOffset + 10) % patientIds.length]!;
      const chairId = chairIds[a % chairIds.length]!;
      const doctorStaffId = doctorStaffIds[a % doctorStaffIds.length] ?? staffIds[0];
      const doctor = await db.doctor.findFirst({
        where: { userId: doctorStaffId },
      });
      const proc = procedures[a % procedures.length];
      const hour = 9 + a * 2;
      const start = daysFromNow(dayOffset, hour, 0);
      const end = addMinutes(start, 45);

      let status: AppointmentStatus = AppointmentStatus.SCHEDULED;

      if (dayOffset < 0) {
        if (canceledLeft > 0 && a === 0) {
          status = AppointmentStatus.CANCELED;
          canceledLeft--;
        } else if (noShowLeft > 0 && a === 1) {
          status = AppointmentStatus.NO_SHOW;
          noShowLeft--;
        } else {
          status = AppointmentStatus.COMPLETED;
        }
      } else if (dayOffset === 0) {
        const now = new Date();
        if (start < now && a === 0) {
          status = AppointmentStatus.COMPLETED;
        } else if (a === 1 && globalChairsideCount < 3) {
          status = AppointmentStatus.IN_CHAIR;
        } else if (start > now) {
          status = AppointmentStatus.SCHEDULED;
        } else {
          status = AppointmentStatus.CONFIRMED;
        }
      } else {
        status = a % 2 === 0 ? AppointmentStatus.CONFIRMED : AppointmentStatus.SCHEDULED;
      }

      const appointment = await db.appointment.create({
        data: {
          tenantId,
          patientId,
          doctorId: doctor?.id ?? null,
          chairId,
          branchId,
          providerId: doctorStaffId,
          title: proc?.name ?? "Dental Visit",
          startTime: start,
          endTime: end,
          status,
          type: proc?.category ?? "GENERAL",
          procedureId: proc?.id ?? null,
        },
      });
      appointmentCount++;

      if (status === AppointmentStatus.COMPLETED) {
        const unitPrice = Number(proc?.price ?? 200);
        const subtotal = unitPrice;
        const tax = subtotal * (profile.taxRate / 100);
        const total = subtotal + tax;
        const invCount = await db.invoice.count({ where: { tenantId } });
        await db.invoice.create({
          data: {
            tenantId,
            patientId,
            invoiceNumber: generateInvoiceNumber(invCount + 1),
            invoiceRef: await generateInvoiceRef(tenantId),
            status: InvoiceStatus.PAID,
            subtotal,
            tax,
            total,
            currency: profile.currency,
            taxName: profile.taxName,
            taxRateApplied: profile.taxRate,
            patientAmount: total,
            items: {
              create: {
                tenantId,
                description: proc?.name ?? "Treatment",
                quantity: 1,
                unitPrice,
                total: unitPrice,
                procedureCode: proc?.code ?? null,
              },
            },
          },
        });
        await db.appointment.update({
          where: { id: appointment.id },
          data: { status: AppointmentStatus.INVOICED },
        });
      }

      if (status === AppointmentStatus.IN_CHAIR && globalChairsideCount < 3) {
        const session = await db.chairsideSession.create({
          data: {
            tenantId,
            patientId,
            appointmentId: appointment.id,
            staffId: doctorStaffId,
            status: CHAIRSIDE_SESSION_STATUS.ACTIVE,
          },
        });
        globalChairsideCount++;

        if (!globalChairsideOrphanId) {
          globalChairsideOrphanId = session.id;
        } else if (!globalChairsideActiveId) {
          globalChairsideActiveId = session.id;
          await db.chairsideEntry.create({
            data: {
              sessionId: session.id,
              tenantId,
              toothNumber: 16,
              surface: "O",
              procedureCode: proc?.code ?? "D0150",
              procedureName: proc?.name ?? "Examination",
              unitPrice: proc?.price ?? 200,
              quantity: 1,
              includeInInvoice: true,
            },
          });
        }
      }
    }
  }

  return {
    tenantId,
    slug: clinic.slug,
    countryCode: clinic.countryCode,
    plan: clinic.plan,
    ownerEmail,
    patientIds,
    doctorStaffIds,
    branchId,
    chairIds,
    procedureIds: procedures.map((p) => p.id),
  };
}

async function seedTreatmentData(
  tenants: TenantSeedResult[],
): Promise<{ plans: number; estimates: number; preAuths: number }> {
  let plans = 0;
  let estimates = 0;
  let preAuths = 0;
  const preAuthStatuses: PreAuthStatus[] = [
    PreAuthStatus.DRAFT,
    PreAuthStatus.SUBMITTED,
    PreAuthStatus.APPROVED,
    PreAuthStatus.DENIED,
  ];

  const allPatients: Array<{
    tenantId: string;
    patientId: string;
    procedureIds: string[];
    ownerStaffId: string;
  }> = [];

  for (const t of tenants) {
    const ownerStaff = await db.staffMember.findFirst({
      where: { tenantId: t.tenantId, role: UserRole.OWNER },
    });
    for (const pid of t.patientIds) {
      allPatients.push({
        tenantId: t.tenantId,
        patientId: pid,
        procedureIds: t.procedureIds,
        ownerStaffId: ownerStaff?.id ?? "",
      });
    }
  }

  const selected = allPatients.filter((_, i) => i % 7 === 0).slice(0, 30);

  for (const [i, entry] of selected.entries()) {
    const procs = await db.procedureCatalog.findMany({
      where: { tenantId: entry.tenantId, isActive: true },
      take: 4,
      skip: i % 3,
    });
    if (procs.length < 2) continue;

    const itemCount = Math.min(procs.length, 2 + (i % 3));
    const chosen = procs.slice(0, itemCount);
    let totalCost = 0;
    const itemsData = chosen.map((proc, idx) => {
      const unit = Number(proc.price);
      totalCost += unit;
      return {
        tenantId: entry.tenantId,
        procedureCode: proc.code,
        procedureCatalogId: proc.id,
        description: proc.name,
        toothNumbers: idx === 0 ? ["16"] : ["26"],
        quantity: 1,
        unitCost: unit,
        totalCost: unit,
        phase: 1,
        visitNumber: idx + 1,
      };
    });

    const plan = await db.treatmentPlan.create({
      data: {
        tenantId: entry.tenantId,
        patientId: entry.patientId,
        title: `Treatment Plan — ${chosen.map((p) => p.name).join(", ").slice(0, 60)}`,
        description: "Seeded test treatment plan",
        status: i % 3 === 0 ? "PROPOSED" : "ACCEPTED",
        totalCost,
        items: { create: itemsData },
      },
      include: { items: true },
    });
    plans++;

    const codes = chosen.map((p) => p.code);
    const split = await calculateInsuranceSplit({
      tenantId: entry.tenantId,
      patientId: entry.patientId,
      procedureCodes: codes,
      totalAmount: totalCost,
    });

    const estimate = await db.treatmentEstimate.create({
      data: {
        tenantId: entry.tenantId,
        patientId: entry.patientId,
        treatmentPlanId: plan.id,
        policyId: split?.policyId ?? null,
        procedureCodes: chosen.map((p) => ({
          code: p.code,
          description: p.name,
          amount: Number(p.price),
        })),
        totalAmount: totalCost,
        estimatedInsurerAmount: split?.insurerAmount ?? 0,
        estimatedPatientAmount: split?.patientAmount ?? totalCost,
        generatedBy: entry.ownerStaffId,
      },
    });
    estimates++;

    const primaryPolicy = await db.patientInsurancePolicy.findFirst({
      where: {
        tenantId: entry.tenantId,
        patientId: entry.patientId,
        rank: PolicyRank.PRIMARY,
        isActive: true,
      },
    });

    if (primaryPolicy && i < 15) {
      const status = preAuthStatuses[i % preAuthStatuses.length]!;
      const preAuth = await db.preAuthorization.create({
        data: {
          tenantId: entry.tenantId,
          estimateId: estimate.id,
          policyId: primaryPolicy.id,
          status,
          referenceNumber:
            status !== PreAuthStatus.DRAFT ? `PA-${10000 + i}` : null,
          submittedAt:
            status !== PreAuthStatus.DRAFT ? addDays(new Date(), -5) : null,
          decisionAt:
            status === PreAuthStatus.APPROVED || status === PreAuthStatus.DENIED
              ? addDays(new Date(), -2)
              : null,
          approvedInsurerAmount:
            status === PreAuthStatus.APPROVED
              ? split?.insurerAmount ?? 0
              : null,
          approvedPatientAmount:
            status === PreAuthStatus.APPROVED
              ? split?.patientAmount ?? 0
              : null,
          denialReason:
            status === PreAuthStatus.DENIED ? "Not medically necessary" : null,
          createdBy: entry.ownerStaffId,
        },
      });
      preAuths++;
      void preAuth;
    }
  }

  return { plans, estimates, preAuths };
}

export async function runTestDataSeed(force: boolean): Promise<SeedSummary> {
  console.log("═══════════════════════════════════════════");
  console.log(" DentaFlow Test Data Seed");
  console.log(` Safety: slug prefix "${TEST_SLUG_PREFIX}" | password "${TEST_PASSWORD}"`);
  console.log(` Mode: ${force ? "FORCE (destructive re-seed)" : "normal"}`);
  console.log("═══════════════════════════════════════════");

  const exists = await testDataExists();
  if (exists && !force) {
    console.log(
      "\n⏭  Test data already exists (test-* tenants found).\n" +
        "    Re-run with --force to delete and re-seed.\n" +
        "    Example: pnpm run seed:test-data -- --force\n",
    );
    const tenants = await db.tenant.findMany({
      where: { slug: { startsWith: TEST_SLUG_PREFIX } },
      select: { slug: true, countryCode: true, subscriptionPlan: true, email: true },
    });
    return {
      tenants: tenants.length,
      byCountry: {},
      patients: 0,
      staff: 0,
      appointments: 0,
      chairs: 0,
      inventoryItems: 0,
      treatmentPlans: 0,
      estimates: 0,
      preAuths: 0,
      chairsideSessions: 0,
      ownerLogins: tenants.map((t) => ({
        slug: t.slug,
        email: t.email ?? ownerEmailForSlug(t.slug),
        country: t.countryCode ?? "?",
        plan: t.subscriptionPlan,
      })),
    };
  }

  if (exists && force) {
    await purgeTestData();
  }

  await ensureGpmr();

  logStep("STEP 2", "Create 20 tenants (4 countries × 5 clinics)");
  const tenantResults: TenantSeedResult[] = [];
  for (const [i, clinic] of TEST_CLINICS.entries()) {
    if (i === 0) {
      logStep("STEPS 3–8", "Per tenant: GPMR import+pricing, staff, chairs, patients, inventory, appointments");
    }
    console.log(`  [${i + 1}/20] ${clinic.name} (${clinic.countryCode}, ${clinic.plan})`);
    tenantResults.push(await seedTenant(clinic, i));
  }

  logStep("STEP 9", "Treatment plans, estimates, and pre-authorizations");
  const treatment = await seedTreatmentData(tenantResults);

  const tenantIds = tenantResults.map((t) => t.tenantId);
  const [
    patientCount,
    staffCount,
    appointmentCount,
    chairCount,
    inventoryCount,
    chairsideCount,
  ] = await Promise.all([
    db.patient.count({ where: { tenantId: { in: tenantIds } } }),
    db.staffMember.count({ where: { tenantId: { in: tenantIds }, isActive: true } }),
    db.appointment.count({ where: { tenantId: { in: tenantIds } } }),
    db.chair.count({ where: { tenantId: { in: tenantIds } } }),
    db.inventoryItem.count({ where: { tenantId: { in: tenantIds } } }),
    db.chairsideSession.count({
      where: { tenantId: { in: tenantIds }, status: CHAIRSIDE_SESSION_STATUS.ACTIVE },
    }),
  ]);

  const byCountry: Record<string, number> = {};
  for (const t of tenantResults) {
    byCountry[t.countryCode] = (byCountry[t.countryCode] ?? 0) + 1;
  }

  const summary: SeedSummary = {
    tenants: tenantResults.length,
    byCountry,
    patients: patientCount,
    staff: staffCount,
    appointments: appointmentCount,
    chairs: chairCount,
    inventoryItems: inventoryCount,
    treatmentPlans: treatment.plans,
    estimates: treatment.estimates,
    preAuths: treatment.preAuths,
    chairsideSessions: chairsideCount,
    ownerLogins: tenantResults.map((t) => ({
      slug: t.slug,
      email: t.ownerEmail,
      country: t.countryCode,
      plan: t.plan,
    })),
    chairsideOrphanSessionId: globalChairsideOrphanId,
    chairsideActiveSessionId: globalChairsideActiveId,
  };

  printSummary(summary);
  return summary;
}

function printSummary(summary: SeedSummary) {
  logStep("STEP 10", "Summary report");
  console.log(`  Tenants:      ${summary.tenants}`);
  console.log(`  By country:   ${JSON.stringify(summary.byCountry)}`);
  console.log(`  Patients:     ${summary.patients}`);
  console.log(`  Staff:        ${summary.staff}`);
  console.log(`  Appointments: ${summary.appointments}`);
  console.log(`  Chairs:       ${summary.chairs}`);
  console.log(`  Inventory:    ${summary.inventoryItems}`);
  console.log(`  Tx plans:     ${summary.treatmentPlans}`);
  console.log(`  Estimates:    ${summary.estimates}`);
  console.log(`  Pre-auths:    ${summary.preAuths}`);
  console.log(`  Active chairside sessions: ${summary.chairsideSessions}`);
  if (summary.chairsideOrphanSessionId) {
    console.log(`  Orphan-test session (zero entries): ${summary.chairsideOrphanSessionId}`);
  }
  if (summary.chairsideActiveSessionId) {
    console.log(`  Active session with entries: ${summary.chairsideActiveSessionId}`);
  }
  console.log("\n  Owner logins (password: Test1234!):");
  for (const o of summary.ownerLogins) {
    console.log(`    [${o.country}/${o.plan}] ${o.slug}`);
    console.log(`      → ${o.email}`);
  }
  console.log("\n✅  Test data seed complete.\n");
}
