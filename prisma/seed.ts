/**
 * DentaFlow — Idempotent demo seed (aligned with current Prisma schema)
 *
 * Run: npx tsx prisma/seed.ts  |  npm run db:seed
 */

import {
  PrismaClient,
  UserRole,
  TenantStatus,
  SubscriptionPlan,
  SubscriptionStatus,
  AppointmentStatus,
  ToothNotation,
  ToothConditionType,
  TreatmentPlanStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

// ─── Stable identifiers (safe to re-run) ──────────────────────────────────────

const PLATFORM_NAME = "DentaFlow Platform";
const DEMO_NAME = "SmileCare Dental Clinic";

const SEED = {
  platform: {
    clerkOrgId: "org_platform_superadmin",
    name: PLATFORM_NAME,
    slug: slugFromName(PLATFORM_NAME),
  },
  demo: {
    clerkOrgId: "org_test_clinic",
    name: DEMO_NAME,
    slug: slugFromName(DEMO_NAME),
  },
  branchId: "seed_branch_smilecare",
  users: {
    platformAdmin: "seed_platform_user_admin",
    owner: "seed_smilecare_user_owner",
    dentist: "seed_smilecare_user_dentist",
    receptionist: "seed_smilecare_user_receptionist",
  },
  patients: ["P000001", "P000002", "P000003", "P000004"] as const,
} as const;

const TRIAL_DAYS = 14;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Kebab-case slug from clinic name, e.g. "SmileCare Dental Clinic" → "smilecare-dental-clinic" */
function slugFromName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base || "clinic";
}

function trialEndsAt(from: Date = new Date()): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + TRIAL_DAYS);
  return end;
}

function daysFromNow(days: number, hour = 10, minute = 0): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function dob(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month - 1, day));
}

// ─── 1. Tenants ───────────────────────────────────────────────────────────────

async function seedPlatformTenant() {
  console.log("🏢 Seeding platform super-admin tenant…");

  const tenant = await prisma.tenant.upsert({
    where: { clerkOrgId: SEED.platform.clerkOrgId },
    create: {
      clerkOrgId: SEED.platform.clerkOrgId,
      name: SEED.platform.name,
      slug: SEED.platform.slug,
      status: TenantStatus.ACTIVE,
      email: "superadmin@dentaflow.com",
      phone: "+971 50 000 0000",
      address: "Platform HQ, Abu Dhabi, UAE",
      city: "Abu Dhabi",
      country: "AE",
      timezone: "Asia/Dubai",
      locale: "en",
      subscriptionPlan: SubscriptionPlan.ENTERPRISE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      trialEndsAt: null,
      onboardingCompleted: true,
      featureFlags: { platform: true },
      metadata: { type: "platform" },
    },
    update: {
      name: SEED.platform.name,
      slug: SEED.platform.slug,
      status: TenantStatus.ACTIVE,
      subscriptionPlan: SubscriptionPlan.ENTERPRISE,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      onboardingCompleted: true,
    },
  });

  await prisma.settings.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      currency: "AED",
      taxRate: 5,
      defaultNotation: ToothNotation.FDI,
    },
    update: { currency: "AED" },
  });

  const admin = await prisma.user.upsert({
    where: {
      tenantId_clerkUserId: {
        tenantId: tenant.id,
        clerkUserId: "user_platform_superadmin",
      },
    },
    create: {
      tenantId: tenant.id,
      clerkUserId: "user_platform_superadmin",
      email: "superadmin@dentaflow.com",
      firstName: "Platform",
      lastName: "Admin",
      role: UserRole.OWNER,
      isActive: true,
    },
    update: { role: UserRole.OWNER, isActive: true },
  });

  console.log(`   ✅ ${tenant.name} (${tenant.slug})`);
  return { tenant, admin };
}

async function seedDemoTenant() {
  console.log("🏥 Seeding demo clinic tenant (14-day trial)…");

  const now = new Date();
  const tenant = await prisma.tenant.upsert({
    where: { clerkOrgId: SEED.demo.clerkOrgId },
    create: {
      clerkOrgId: SEED.demo.clerkOrgId,
      name: SEED.demo.name,
      slug: SEED.demo.slug,
      status: TenantStatus.ACTIVE,
      email: "admin@smilecare.local",
      phone: "+971 50 848 1710",
      address: "Khalifa City, Abu Dhabi, UAE",
      city: "Abu Dhabi",
      country: "AE",
      timezone: "Asia/Dubai",
      locale: "en",
      subscriptionPlan: SubscriptionPlan.STARTER,
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialEndsAt: trialEndsAt(now),
      onboardingCompleted: true,
      featureFlags: { odontogram: true },
      metadata: { emirate: "Abu Dhabi" },
    },
    update: {
      name: SEED.demo.name,
      slug: SEED.demo.slug,
      status: TenantStatus.ACTIVE,
      subscriptionPlan: SubscriptionPlan.STARTER,
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialEndsAt: trialEndsAt(now),
      onboardingCompleted: true,
    },
  });

  await prisma.settings.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      currency: "AED",
      taxRate: 5,
      defaultNotation: ToothNotation.FDI,
      appointmentDuration: 30,
    },
    update: { currency: "AED", defaultNotation: ToothNotation.FDI },
  });

  console.log(
    `   ✅ ${tenant.name} (${tenant.slug}) — ${SubscriptionStatus.TRIALING} until ${tenant.trialEndsAt?.toLocaleDateString()}`,
  );
  return tenant;
}

// ─── 2. Branch, chairs, staff ─────────────────────────────────────────────────

async function seedClinicInfrastructure(tenantId: string) {
  console.log("🪑 Seeding branch, chairs & staff…");

  const branch = await prisma.branch.upsert({
    where: { id: SEED.branchId },
    create: {
      id: SEED.branchId,
      tenantId,
      name: "SmileCare Main Clinic",
      address: "Khalifa City, Abu Dhabi, UAE",
      phone: "+971 50 848 1710",
      isPrimary: true,
    },
    update: { name: "SmileCare Main Clinic" },
  });

  const chairs = [];
  for (let n = 1; n <= 3; n++) {
    const chair = await prisma.chair.upsert({
      where: { tenantId_branchId_number: { tenantId, branchId: branch.id, number: n } },
      create: {
        tenantId,
        branchId: branch.id,
        name: `Operatory ${n}`,
        number: n,
        isActive: true,
      },
      update: { name: `Operatory ${n}` },
    });
    chairs.push(chair);
  }

  type StaffDef = {
    id: string;
    clerkUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isDoctor?: boolean;
    specialty?: string;
    chairNumber?: number;
  };

  const staff: StaffDef[] = [
    {
      id: SEED.users.owner,
      clerkUserId: "user_seed_owner",
      email: "dr.owner@smilecare.local",
      firstName: "Ahmed",
      lastName: "Al Kaabi",
      role: UserRole.OWNER,
      isDoctor: true,
      specialty: "General Dentistry",
      chairNumber: 1,
    },
    {
      id: SEED.users.dentist,
      clerkUserId: "user_seed_dentist",
      email: "dr.menon@smilecare.local",
      firstName: "Sanjay",
      lastName: "Menon",
      role: UserRole.DENTIST,
      isDoctor: true,
      specialty: "Endodontics",
      chairNumber: 2,
    },
    {
      id: SEED.users.receptionist,
      clerkUserId: "user_seed_receptionist",
      email: "reception@smilecare.local",
      firstName: "Aisha",
      lastName: "Rahman",
      role: UserRole.RECEPTIONIST,
    },
  ];

  const users: Record<string, Awaited<ReturnType<typeof prisma.user.upsert>>> = {};
  const doctors: Record<string, Awaited<ReturnType<typeof prisma.doctor.upsert>>> = {};

  for (const s of staff) {
    const user = await prisma.user.upsert({
      where: { tenantId_clerkUserId: { tenantId, clerkUserId: s.clerkUserId } },
      create: {
        tenantId,
        clerkUserId: s.clerkUserId,
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        role: s.role,
        isActive: true,
      },
      update: { firstName: s.firstName, lastName: s.lastName, role: s.role },
    });
    users[s.id] = user;

    if (s.isDoctor) {
      const doctor = await prisma.doctor.upsert({
        where: { userId: user.id },
        create: {
          tenantId,
          userId: user.id,
          specialty: s.specialty,
          licenseNo: `DHA-${s.lastName.slice(0, 3).toUpperCase()}-001`,
          color: s.id === SEED.users.owner ? "#0ea5e9" : "#8b5cf6",
        },
        update: { specialty: s.specialty },
      });
      doctors[s.id] = doctor;

      const chair = chairs.find((c) => c.number === s.chairNumber);
      if (chair) {
        await prisma.chair.update({
          where: { id: chair.id },
          data: { doctorId: doctor.id },
        });
      }
    }
  }

  console.log(`   ✅ Branch + ${chairs.length} chairs + ${staff.length} staff`);
  return { branch, chairs, users, doctors };
}

// ─── 3. Patients ──────────────────────────────────────────────────────────────

async function seedPatients(tenantId: string) {
  console.log("🧑‍⚕️ Seeding patients…");

  const defs = [
    {
      patientNumber: "P000001",
      firstName: "Gopi",
      lastName: "K Unnithan",
      email: "gopi.k@live.com",
      phone: "+971 50 848 1710",
      dateOfBirth: dob(1985, 5, 15),
      gender: "Male",
      address: "Reem Island, Abu Dhabi",
      city: "Abu Dhabi",
      allergies: ["Penicillin", "Latex"],
      medications: ["Metformin 500mg"],
      medicalHistory: {
        conditions: ["Type 2 Diabetes (controlled)"],
        alerts: ["Monitor BP before procedures"],
      },
      notes: "VIP patient — prefers morning appointments.",
      lastVisitAt: daysFromNow(-14),
    },
    {
      patientNumber: "P000002",
      firstName: "Fatima",
      lastName: "Al Mansouri",
      email: "fatima@demo.com",
      phone: "+971 55 555 1234",
      dateOfBirth: dob(1995, 3, 12),
      gender: "Female",
      city: "Abu Dhabi",
      allergies: ["Aspirin"],
      dentalHistory: { concerns: ["Bleeding gums"] },
      lastVisitAt: daysFromNow(-30),
    },
    {
      patientNumber: "P000003",
      firstName: "Mohammed",
      lastName: "Al Hashmi",
      phone: "+971 50 666 9876",
      dateOfBirth: dob(1978, 11, 5),
      gender: "Male",
      city: "Abu Dhabi",
      notes: "Implant consultation scheduled.",
      lastVisitAt: daysFromNow(-7),
    },
    {
      patientNumber: "P000004",
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya@demo.com",
      phone: "+971 58 678 9012",
      dateOfBirth: dob(1990, 9, 5),
      gender: "Female",
      city: "Abu Dhabi",
      allergies: [],
    },
  ];

  const patients: Record<string, Awaited<ReturnType<typeof prisma.patient.upsert>>> = {};
  for (const p of defs) {
    const { patientNumber, ...data } = p;
    const patient = await prisma.patient.upsert({
      where: { tenantId_patientNumber: { tenantId, patientNumber } },
      create: { tenantId, patientNumber, ...data },
      update: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        allergies: data.allergies ?? [],
        lastVisitAt: data.lastVisitAt,
      },
    });
    patients[patientNumber] = patient;
  }

  console.log(`   ✅ ${defs.length} patients (Gopi K Unnithan = P000001)`);
  return patients;
}

// ─── 4. Appointments ──────────────────────────────────────────────────────────

async function seedAppointments(
  tenantId: string,
  branchId: string,
  patients: Record<string, { id: string }>,
  doctors: Record<string, { id: string }>,
  chairs: { id: string; number: number }[],
  users: Record<string, { id: string }>,
) {
  console.log("📅 Seeding appointments…");

  const ownerDoc = doctors[SEED.users.owner];
  const specialistDoc = doctors[SEED.users.dentist];
  const chair1 = chairs.find((c) => c.number === 1)!;
  const chair2 = chairs.find((c) => c.number === 2)!;

  type ApptDef = {
    id: string;
    patientNumber: string;
    title: string;
    daysOffset: number;
    hour: number;
    durationMin: number;
    status: AppointmentStatus;
    type: string;
    doctorId?: string;
    providerId?: string;
    chairId?: string;
  };

  const appts: ApptDef[] = [
    {
      id: "seed_appt_gopi_completed",
      patientNumber: "P000001",
      title: "Scaling & Polishing",
      daysOffset: -3,
      hour: 9,
      durationMin: 45,
      status: AppointmentStatus.COMPLETED,
      type: "Hygiene",
      doctorId: ownerDoc?.id,
      providerId: users[SEED.users.owner]?.id,
      chairId: chair1.id,
    },
    {
      id: "seed_appt_gopi_upcoming",
      patientNumber: "P000001",
      title: "Composite Filling #26",
      daysOffset: 2,
      hour: 10,
      durationMin: 60,
      status: AppointmentStatus.CONFIRMED,
      type: "Restorative",
      doctorId: specialistDoc?.id,
      chairId: chair2.id,
    },
    {
      id: "seed_appt_fatima_scheduled",
      patientNumber: "P000002",
      title: "Routine Checkup",
      daysOffset: 5,
      hour: 11,
      durationMin: 30,
      status: AppointmentStatus.SCHEDULED,
      type: "Checkup",
      doctorId: ownerDoc?.id,
      chairId: chair1.id,
    },
    {
      id: "seed_appt_mohammed_noshow",
      patientNumber: "P000003",
      title: "Implant Consultation",
      daysOffset: -5,
      hour: 14,
      durationMin: 45,
      status: AppointmentStatus.NO_SHOW,
      type: "Consultation",
      doctorId: specialistDoc?.id,
      chairId: chair2.id,
    },
    {
      id: "seed_appt_priya_today",
      patientNumber: "P000004",
      title: "New Patient Exam",
      daysOffset: 1,
      hour: 15,
      durationMin: 60,
      status: AppointmentStatus.SCHEDULED,
      type: "New Patient",
      doctorId: ownerDoc?.id,
      chairId: chair1.id,
    },
  ];

  for (const a of appts) {
    const patient = patients[a.patientNumber];
    const startTime = daysFromNow(a.daysOffset, a.hour);
    const endTime = addMinutes(startTime, a.durationMin);

    await prisma.appointment.upsert({
      where: { id: a.id },
      create: {
        id: a.id,
        tenantId,
        patientId: patient.id,
        branchId,
        doctorId: a.doctorId,
        providerId: a.providerId,
        chairId: a.chairId,
        title: a.title,
        startTime,
        endTime,
        status: a.status,
        type: a.type,
        reminderSent: a.daysOffset > 0,
      },
      update: { title: a.title, startTime, endTime, status: a.status },
    });
  }

  console.log(`   ✅ ${appts.length} appointments (past + upcoming)`);
}

// ─── 5. Odontogram ───────────────────────────────────────────────────────────

async function seedOdontogram(
  tenantId: string,
  patients: Record<string, { id: string; patientNumber: string }>,
) {
  console.log("🦷 Seeding odontogram data…");

  type CondDef = {
    id: string;
    patientNumber: string;
    toothNumber: string;
    type: ToothConditionType;
    surfaces?: string[];
    severity?: number;
    notes?: string;
  };

  const conditions: CondDef[] = [
    {
      id: "seed_tc_gopi_16_crown",
      patientNumber: "P000001",
      toothNumber: "16",
      type: ToothConditionType.CROWN,
      notes: "PFM crown 2023",
    },
    {
      id: "seed_tc_gopi_26_caries",
      patientNumber: "P000001",
      toothNumber: "26",
      type: ToothConditionType.CARIES,
      surfaces: ["O", "M"],
      severity: 2,
      notes: "Moderate occlusal-mesial caries",
    },
    {
      id: "seed_tc_gopi_36_missing",
      patientNumber: "P000001",
      toothNumber: "36",
      type: ToothConditionType.MISSING,
      notes: "Extracted 2020 — implant planned",
    },
    {
      id: "seed_tc_gopi_46_rct",
      patientNumber: "P000001",
      toothNumber: "46",
      type: ToothConditionType.ROOT_CANAL,
      notes: "RCT completed — awaiting crown",
    },
    {
      id: "seed_tc_fatima_14_caries",
      patientNumber: "P000002",
      toothNumber: "14",
      type: ToothConditionType.CARIES,
      surfaces: ["D"],
      severity: 1,
    },
    {
      id: "seed_tc_fatima_24_perio",
      patientNumber: "P000002",
      toothNumber: "24",
      type: ToothConditionType.PERIO_POCKET,
      notes: "5mm pocket — scaling planned",
    },
  ];

  for (const c of conditions) {
    const patient = patients[c.patientNumber];
    const tooth = await prisma.tooth.upsert({
      where: {
        tenantId_patientId_number: { tenantId, patientId: patient.id, number: c.toothNumber },
      },
      create: {
        tenantId,
        patientId: patient.id,
        number: c.toothNumber,
        notation: ToothNotation.FDI,
      },
      update: {},
    });

    await prisma.toothCondition.upsert({
      where: { id: c.id },
      create: {
        id: c.id,
        tenantId,
        patientId: patient.id,
        toothId: tooth.id,
        type: c.type,
        surfaces: c.surfaces ?? [],
        severity: c.severity,
        notes: c.notes,
      },
      update: { type: c.type, surfaces: c.surfaces ?? [], notes: c.notes },
    });
  }

  console.log(`   ✅ ${conditions.length} tooth conditions for Gopi + Fatima`);
}

// ─── 6. Treatment plans ───────────────────────────────────────────────────────

async function seedTreatmentPlans(
  tenantId: string,
  patients: Record<string, { id: string; patientNumber: string }>,
) {
  console.log("📝 Seeding treatment plans…");

  const gopi = patients.P000001;
  const mohammed = patients.P000003;

  await prisma.treatmentPlan.upsert({
    where: { id: "seed_tp_gopi_rehab" },
    create: {
      id: "seed_tp_gopi_rehab",
      tenantId,
      patientId: gopi.id,
      title: "Restorative Plan — Phase 1",
      description: "Address caries #26, crown #46 post-RCT",
      status: TreatmentPlanStatus.IN_PROGRESS,
      phase: 1,
      totalCost: 3250,
      acceptedAt: daysFromNow(-21),
    },
    update: { status: TreatmentPlanStatus.IN_PROGRESS },
  });

  await prisma.treatmentItem.upsert({
    where: { id: "seed_ti_gopi_filling" },
    create: {
      id: "seed_ti_gopi_filling",
      tenantId,
      treatmentPlanId: "seed_tp_gopi_rehab",
      procedureCode: "D2140",
      description: "Composite Filling #26",
      toothNumbers: ["26"],
      quantity: 1,
      unitCost: 450,
      totalCost: 450,
      phase: 1,
      status: "pending",
    },
    update: { status: "pending" },
  });

  await prisma.treatmentItem.upsert({
    where: { id: "seed_ti_gopi_crown" },
    create: {
      id: "seed_ti_gopi_crown",
      tenantId,
      treatmentPlanId: "seed_tp_gopi_rehab",
      procedureCode: "D2750",
      description: "Porcelain Crown #46",
      toothNumbers: ["46"],
      quantity: 1,
      unitCost: 2800,
      totalCost: 2800,
      phase: 1,
      status: "in_progress",
    },
    update: { status: "in_progress" },
  });

  await prisma.treatmentPlan.upsert({
    where: { id: "seed_tp_mohammed_implant" },
    create: {
      id: "seed_tp_mohammed_implant",
      tenantId,
      patientId: mohammed.id,
      title: "Implant — #36",
      description: "Replace missing #36 with implant-supported crown",
      status: TreatmentPlanStatus.PROPOSED,
      phase: 1,
      totalCost: 9700,
    },
    update: { status: TreatmentPlanStatus.PROPOSED },
  });

  console.log("   ✅ 2 treatment plans with line items");
}

// ─── 7. Procedure catalog (dashboard extras) ──────────────────────────────────

async function seedProcedures(tenantId: string) {
  await prisma.procedureCatalog.createMany({
    data: [
      { tenantId, code: "D1110", name: "Scaling & Polishing", category: "Preventive", price: 350 },
      { tenantId, code: "D2140", name: "Composite Filling — 1 Surface", category: "Restorative", price: 450 },
      { tenantId, code: "D2750", name: "Porcelain Crown", category: "Restorative", price: 2800 },
      { tenantId, code: "D6010", name: "Implant Placement", category: "Implants", price: 6500 },
    ],
    skipDuplicates: true,
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱 DentaFlow seed starting…\n");

  const { tenant: platformTenant } = await seedPlatformTenant();
  const demoTenant = await seedDemoTenant();
  const { branch, chairs, users, doctors } = await seedClinicInfrastructure(demoTenant.id);
  const patients = await seedPatients(demoTenant.id);

  await seedAppointments(
    demoTenant.id,
    branch.id,
    patients,
    doctors,
    chairs,
    users,
  );
  await seedOdontogram(demoTenant.id, patients);
  await seedTreatmentPlans(demoTenant.id, patients);
  await seedProcedures(demoTenant.id);

  console.log("\n🎉 Seed complete!\n");
  console.log("Summary:");
  console.log(`   🏢 Platform:  ${platformTenant.name} (${SEED.platform.clerkOrgId})`);
  console.log(`   🏥 Demo:      ${demoTenant.name} (${SEED.demo.clerkOrgId})`);
  console.log(`   📛 Slugs:     ${SEED.platform.slug} | ${SEED.demo.slug}`);
  console.log(`   ⏳ Trial:     ${SubscriptionStatus.TRIALING} until ${demoTenant.trialEndsAt?.toLocaleDateString()}`);
  console.log(`   👤 Patients:  Gopi K Unnithan (P000001) + 3 more`);
  console.log("\n💡 Safe to re-run — all operations are idempotent.\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Seed failed:\n", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
