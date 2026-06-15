/**
 * DentaFlow — Production-ready demo seed
 *
 * Populates Pearl Dental Centre (Abu Dhabi) with realistic test data for:
 * Odontogram, Patient 360, Appointments, Treatment Plans, Billing, Inventory.
 *
 * Idempotent: safe to re-run via upsert + createMany({ skipDuplicates: true }).
 * Run: npx tsx prisma/seed.ts  OR  npm run db:seed
 */

import {
  PrismaClient,
  UserRole,
  SubscriptionPlan,
  SubscriptionStatus,
  TenantStatus,
  AppointmentStatus,
  ToothNotation,
  ToothConditionType,
  TreatmentPlanStatus,
  InvoiceStatus,
  PaymentMethod,
  StockTransactionType,
  RiskLevel,
  LeadStatus,
  type Prisma,
} from "@prisma/client";

const prisma = new PrismaClient();

// ─── Stable seed identifiers (enables idempotent upserts) ─────────────────────

const SEED = {
  tenantClerkOrgId: "org_pearl_dental_abu_dhabi",
  branchId: "seed_branch_khalidiyah",
  users: {
    owner: "seed_user_owner",
    dentist: "seed_user_dentist",
    receptionist: "seed_user_receptionist",
    hygienist: "seed_user_hygienist",
  },
  patients: ["P000001", "P000002", "P000003", "P000004", "P000005", "P000006"] as const,
} as const;

// ─── Date helpers ─────────────────────────────────────────────────────────────

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

// ─── 1. Tenant (Clinic) ───────────────────────────────────────────────────────

async function seedTenant() {
  console.log("🏥 Seeding tenant — Pearl Dental Centre, Abu Dhabi…");

  const tenant = await prisma.tenant.upsert({
    where: { clerkOrgId: SEED.tenantClerkOrgId },
    create: {
      clerkOrgId: SEED.tenantClerkOrgId,
      name: "Pearl Dental Centre",
      slug: "pearl-dental-khalidiyah",
      status: TenantStatus.ACTIVE,
      email: "info@pearldental.ae",
      phone: "+971 2 555 1234",
      address: "Khalidiyah Street, Building 12",
      city: "Abu Dhabi",
      country: "AE",
      timezone: "Asia/Dubai",
      locale: "en",
      subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      onboardingCompleted: true,
      featureFlags: { odontogram: true, patientPortal: true, onlinePayments: true },
      metadata: { emirate: "Abu Dhabi", licenseNo: "DOH-AD-2024-8842" },
    },
    update: {
      name: "Pearl Dental Centre",
      city: "Abu Dhabi",
      country: "AE",
      timezone: "Asia/Dubai",
      status: TenantStatus.ACTIVE,
      onboardingCompleted: true,
    },
  });

  await prisma.settings.upsert({
    where: { tenantId: tenant.id },
    create: {
      tenantId: tenant.id,
      defaultNotation: ToothNotation.FDI,
      appointmentDuration: 30,
      reminderHoursBefore: 24,
      currency: "AED",
      taxRate: 5,
      enablePatientPortal: true,
      enableOnlinePayments: true,
    },
    update: { currency: "AED", taxRate: 5, defaultNotation: ToothNotation.FDI },
  });

  console.log(`   ✅ Tenant ready: ${tenant.name} (${tenant.id})`);
  return tenant;
}

// ─── 2. Branch & Chairs ───────────────────────────────────────────────────────

async function seedBranchAndChairs(tenantId: string) {
  console.log("🪑 Seeding branch and operatories…");

  const branch = await prisma.branch.upsert({
    where: { id: SEED.branchId },
    create: {
      id: SEED.branchId,
      tenantId,
      name: "Khalidiyah Main Clinic",
      address: "Khalidiyah Street, Building 12, Abu Dhabi",
      phone: "+971 2 555 1234",
      isPrimary: true,
    },
    update: { name: "Khalidiyah Main Clinic" },
  });

  const chairNames = ["Op 1 — Dr. Al Kaabi", "Op 2 — Dr. Menon", "Op 3 — Hygiene", "Op 4 — Emergency"];
  const chairs = [];
  for (let n = 1; n <= 4; n++) {
    const chair = await prisma.chair.upsert({
      where: { tenantId_branchId_number: { tenantId, branchId: branch.id, number: n } },
      create: {
        tenantId,
        branchId: branch.id,
        name: chairNames[n - 1],
        number: n,
        isActive: true,
      },
      update: { name: chairNames[n - 1] },
    });
    chairs.push(chair);
  }

  console.log(`   ✅ Branch + ${chairs.length} chairs`);
  return { branch, chairs };
}

// ─── 3. Staff ─────────────────────────────────────────────────────────────────

async function seedStaff(tenantId: string, chairs: { id: string; number: number }[]) {
  console.log("👥 Seeding staff…");

  type StaffDef = {
    id: string;
    clerkUserId: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
    isDoctor?: boolean;
    specialty?: string;
    licenseNo?: string;
    color?: string;
    chairNumber?: number;
  };

  const staffDefs: StaffDef[] = [
    {
      id: SEED.users.owner,
      clerkUserId: "user_seed_dr_alkaabi",
      email: "dr.alkaabi@pearldental.ae",
      firstName: "Ahmed",
      lastName: "Al Kaabi",
      role: UserRole.OWNER,
      isDoctor: true,
      specialty: "General & Cosmetic Dentistry",
      licenseNo: "DHA-GD-4521",
      color: "#0ea5e9",
      chairNumber: 1,
    },
    {
      id: SEED.users.dentist,
      clerkUserId: "user_seed_dr_menon",
      email: "dr.menon@pearldental.ae",
      firstName: "Sanjay",
      lastName: "Menon",
      role: UserRole.DENTIST,
      isDoctor: true,
      specialty: "Endodontics & Implants",
      licenseNo: "DHA-EN-3310",
      color: "#8b5cf6",
      chairNumber: 2,
    },
    {
      id: SEED.users.receptionist,
      clerkUserId: "user_seed_aisha",
      email: "aisha@pearldental.ae",
      firstName: "Aisha",
      lastName: "Rahman",
      role: UserRole.RECEPTIONIST,
    },
    {
      id: SEED.users.hygienist,
      clerkUserId: "user_seed_lina",
      email: "lina@pearldental.ae",
      firstName: "Lina",
      lastName: "Joseph",
      role: UserRole.HYGIENIST,
    },
  ];

  const users: Record<string, Awaited<ReturnType<typeof prisma.user.upsert>>> = {};
  const doctors: Record<string, Awaited<ReturnType<typeof prisma.doctor.upsert>>> = {};

  for (const s of staffDefs) {
    const user = await prisma.user.upsert({
      where: { tenantId_clerkUserId: { tenantId, clerkUserId: s.clerkUserId } },
      create: {
        id: s.id,
        tenantId,
        clerkUserId: s.clerkUserId,
        email: s.email,
        firstName: s.firstName,
        lastName: s.lastName,
        role: s.role,
        isActive: true,
      },
      update: { firstName: s.firstName, lastName: s.lastName, role: s.role, isActive: true },
    });
    users[s.id] = user;

    if (s.isDoctor) {
      const doctor = await prisma.doctor.upsert({
        where: { userId: user.id },
        create: {
          tenantId,
          userId: user.id,
          specialty: s.specialty,
          licenseNo: s.licenseNo,
          color: s.color ?? "#0ea5e9",
        },
        update: { specialty: s.specialty, licenseNo: s.licenseNo },
      });
      doctors[s.id] = doctor;

      if (s.chairNumber) {
        const chair = chairs.find((c) => c.number === s.chairNumber);
        if (chair) {
          await prisma.chair.update({
            where: { id: chair.id },
            data: { doctorId: doctor.id },
          });
        }
      }
    }
  }

  console.log(`   ✅ ${staffDefs.length} staff members (${Object.keys(doctors).length} doctors)`);
  return { users, doctors, owner: users[SEED.users.owner], dentist: users[SEED.users.dentist] };
}

// ─── 4. Procedure Catalog ─────────────────────────────────────────────────────

async function seedProcedures(tenantId: string) {
  console.log("📋 Seeding procedure catalog…");

  const procedures: Prisma.ProcedureCatalogCreateManyInput[] = [
    { tenantId, code: "D1110", name: "Scaling & Polishing (Adult)", category: "Preventive", price: 350, duration: 45 },
    { tenantId, code: "D2140", name: "Composite Filling — 1 Surface", category: "Restorative", price: 450, duration: 30 },
    { tenantId, code: "D2750", name: "Porcelain Crown", category: "Restorative", price: 2800, duration: 60 },
    { tenantId, code: "D3310", name: "Root Canal — Anterior", category: "Endodontics", price: 2200, duration: 90 },
    { tenantId, code: "D6010", name: "Implant — Surgical Placement", category: "Implants", price: 6500, duration: 120 },
    { tenantId, code: "D7140", name: "Extraction — Simple", category: "Surgery", price: 600, duration: 30 },
    { tenantId, code: "D1206", name: "Fluoride Varnish", category: "Preventive", price: 180, duration: 15 },
    { tenantId, code: "D4341", name: "Periodontal Scaling — Per Quadrant", category: "Periodontics", price: 800, duration: 45 },
    { tenantId, code: "D2950", name: "Core Buildup", category: "Restorative", price: 750, duration: 45 },
    { tenantId, code: "D6058", name: "Implant Crown — Porcelain", category: "Implants", price: 3200, duration: 60 },
  ];

  const result = await prisma.procedureCatalog.createMany({ data: procedures, skipDuplicates: true });
  console.log(`   ✅ ${result.count} procedures added (${procedures.length} defined)`);
}

// ─── 5. Patients ──────────────────────────────────────────────────────────────

type PatientSeed = {
  patientNumber: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  gender: string;
  address: string;
  city: string;
  emergencyContact: string;
  emergencyPhone: string;
  allergies: string[];
  medications: string[];
  medicalHistory: Prisma.InputJsonValue;
  dentalHistory: Prisma.InputJsonValue;
  notes?: string;
  churnRisk?: RiskLevel;
  noShowRisk?: RiskLevel;
  lastVisitAt?: Date;
};

async function seedPatients(tenantId: string) {
  console.log("🧑‍⚕️ Seeding patients…");

  const patientDefs: PatientSeed[] = [
    {
      patientNumber: "P000001",
      firstName: "Gopi",
      lastName: "K Unnithan",
      email: "gopi.unnithan@gmail.com",
      phone: "+971 50 123 4567",
      dateOfBirth: dob(1985, 3, 15),
      gender: "Male",
      address: "Reem Island, Tower 5, Apt 1204",
      city: "Abu Dhabi",
      emergencyContact: "Anitha Unnithan (Spouse)",
      emergencyPhone: "+971 50 987 6543",
      allergies: ["Penicillin", "Latex"],
      medications: ["Metformin 500mg", "Amlodipine 5mg"],
      medicalHistory: {
        conditions: ["Type 2 Diabetes (controlled)", "Hypertension"],
        alerts: ["Monitor BP before procedures", "Diabetic — schedule morning appointments"],
        lastMedicalUpdate: "2026-01-10",
      },
      dentalHistory: {
        lastCleaning: "2025-09-12",
        previousDentist: "Smile Care Dubai",
        habits: ["Occasional teeth grinding (bruxism)"],
      },
      notes: "VIP patient — prefers Dr. Menon for RCT. Anxious about injections.",
      churnRisk: RiskLevel.LOW,
      noShowRisk: RiskLevel.LOW,
      lastVisitAt: daysFromNow(-14),
    },
    {
      patientNumber: "P000002",
      firstName: "Fatima",
      lastName: "Al Mansoori",
      email: "fatima.mansoori@outlook.ae",
      phone: "+971 55 234 5678",
      dateOfBirth: dob(1992, 7, 22),
      gender: "Female",
      address: "Al Bateen, Villa 18",
      city: "Abu Dhabi",
      emergencyContact: "Khalid Al Mansoori (Brother)",
      emergencyPhone: "+971 50 111 2233",
      allergies: ["Aspirin"],
      medications: [],
      medicalHistory: { conditions: ["Pregnancy — 2nd trimester"], alerts: ["Avoid non-emergency X-rays"] },
      dentalHistory: { lastCleaning: "2025-06-01", concerns: ["Bleeding gums", "Sensitivity to cold"] },
      notes: "Prefers female hygienist when available.",
      churnRisk: RiskLevel.MEDIUM,
      noShowRisk: RiskLevel.LOW,
      lastVisitAt: daysFromNow(-45),
    },
    {
      patientNumber: "P000003",
      firstName: "Rajesh",
      lastName: "Nair",
      email: "rajesh.nair@yahoo.com",
      phone: "+971 52 345 6789",
      dateOfBirth: dob(1978, 11, 8),
      gender: "Male",
      address: "Mussafah, Sector M-14",
      city: "Abu Dhabi",
      emergencyContact: "Lakshmi Nair (Wife)",
      emergencyPhone: "+971 52 999 8877",
      allergies: [],
      medications: ["Atorvastatin 20mg"],
      medicalHistory: { conditions: ["Hyperlipidemia"] },
      dentalHistory: { missingTeeth: ["38", "48"], plannedImplants: true },
      notes: "Implant case — deposit paid. Travels frequently for work.",
      churnRisk: RiskLevel.LOW,
      noShowRisk: RiskLevel.MEDIUM,
      lastVisitAt: daysFromNow(-7),
    },
    {
      patientNumber: "P000004",
      firstName: "Sarah",
      lastName: "Ahmed",
      email: "sarah.ahmed@gmail.com",
      phone: "+971 56 456 7890",
      dateOfBirth: dob(2001, 1, 30),
      gender: "Female",
      address: "Al Khalidiya, Flat 302",
      city: "Abu Dhabi",
      emergencyContact: "Omar Ahmed (Father)",
      emergencyPhone: "+971 50 444 5566",
      allergies: ["Codeine"],
      medications: [],
      medicalHistory: {},
      dentalHistory: { orthodonticHistory: "Braces removed 2023" },
      notes: "University student — flexible with afternoon slots.",
      lastVisitAt: daysFromNow(-30),
    },
    {
      patientNumber: "P000005",
      firstName: "Mohammed",
      lastName: "Hassan",
      email: "m.hassan@emirates.ae",
      phone: "+971 54 567 8901",
      dateOfBirth: dob(1965, 5, 12),
      gender: "Male",
      address: "Corniche Road, Al Zahiyah",
      city: "Abu Dhabi",
      emergencyContact: "Fatima Hassan (Wife)",
      emergencyPhone: "+971 54 567 8902",
      allergies: ["Sulfa drugs"],
      medications: ["Warfarin 5mg"],
      medicalHistory: {
        conditions: ["Atrial fibrillation", "On anticoagulation"],
        alerts: ["INR check required before extractions", "High medical risk"],
      },
      dentalHistory: { crowns: ["16", "26"], rct: ["46"] },
      notes: "Requires medical clearance for surgical procedures.",
      churnRisk: RiskLevel.LOW,
      noShowRisk: RiskLevel.LOW,
      lastVisitAt: daysFromNow(-3),
    },
    {
      patientNumber: "P000006",
      firstName: "Priya",
      lastName: "Sharma",
      email: "priya.sharma@hotmail.com",
      phone: "+971 58 678 9012",
      dateOfBirth: dob(1988, 9, 5),
      gender: "Female",
      address: "Khalifa City A, Street 7",
      city: "Abu Dhabi",
      emergencyContact: "Vikram Sharma (Husband)",
      emergencyPhone: "+971 58 678 9013",
      allergies: [],
      medications: [],
      medicalHistory: {},
      dentalHistory: {},
      notes: "New patient referral from Gopi K Unnithan.",
      churnRisk: RiskLevel.HIGH,
      noShowRisk: RiskLevel.HIGH,
    },
  ];

  const patients: Record<string, Awaited<ReturnType<typeof prisma.patient.upsert>>> = {};
  for (const p of patientDefs) {
    const patient = await prisma.patient.upsert({
      where: { tenantId_patientNumber: { tenantId, patientNumber: p.patientNumber } },
      create: { tenantId, ...p },
      update: {
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone,
        allergies: p.allergies,
        medications: p.medications,
        medicalHistory: p.medicalHistory,
        dentalHistory: p.dentalHistory,
        notes: p.notes,
        lastVisitAt: p.lastVisitAt,
      },
    });
    patients[p.patientNumber] = patient;
  }

  console.log(`   ✅ ${patientDefs.length} patients (incl. Gopi K Unnithan P000001)`);
  return patients;
}

// ─── 6. Odontogram (Teeth + Conditions) ───────────────────────────────────────

type ToothConditionDef = {
  id: string;
  toothNumber: string;
  type: ToothConditionType;
  surfaces?: string[];
  severity?: number;
  mobility?: number;
  pocketDepth?: number;
  notes?: string;
};

async function seedOdontogram(
  tenantId: string,
  patients: Record<string, { id: string; patientNumber: string }>,
  recordedBy: string,
) {
  console.log("🦷 Seeding odontogram data…");

  const charts: Record<string, ToothConditionDef[]> = {
    P000001: [
      { id: "seed_tc_gopi_16_crown", toothNumber: "16", type: ToothConditionType.CROWN, notes: "PFM crown placed 2022" },
      {
        id: "seed_tc_gopi_26_caries",
        toothNumber: "26",
        type: ToothConditionType.CARIES,
        surfaces: ["O", "M"],
        severity: 2,
        notes: "Moderate occlusal-mesial caries — plan composite",
      },
      {
        id: "seed_tc_gopi_36_restoration",
        toothNumber: "36",
        type: ToothConditionType.RESTORATION,
        surfaces: ["O"],
        notes: "Composite restoration 2024",
      },
      {
        id: "seed_tc_gopi_46_rct",
        toothNumber: "46",
        type: ToothConditionType.ROOT_CANAL,
        notes: "RCT completed Jan 2026 — awaiting crown",
      },
      { id: "seed_tc_gopi_38_missing", toothNumber: "38", type: ToothConditionType.MISSING, notes: "Extracted 2019" },
      { id: "seed_tc_gopi_48_implant", toothNumber: "48", type: ToothConditionType.IMPLANT, notes: "Straumann implant 2025" },
      {
        id: "seed_tc_gopi_11_healthy",
        toothNumber: "11",
        type: ToothConditionType.HEALTHY,
        notes: "No pathology",
      },
    ],
    P000002: [
      {
        id: "seed_tc_fatima_14_caries",
        toothNumber: "14",
        type: ToothConditionType.CARIES,
        surfaces: ["D"],
        severity: 1,
        notes: "Early interproximal lesion",
      },
      {
        id: "seed_tc_fatima_24_perio",
        toothNumber: "24",
        type: ToothConditionType.PERIO_POCKET,
        pocketDepth: 5,
        notes: "5mm pocket — refer for scaling",
      },
      {
        id: "seed_tc_fatima_34_mobility",
        toothNumber: "34",
        type: ToothConditionType.MOBILITY,
        mobility: 2,
        notes: "Grade II mobility — splinting discussed",
      },
      {
        id: "seed_tc_fatima_44_fracture",
        toothNumber: "44",
        type: ToothConditionType.FRACTURE,
        surfaces: ["I"],
        severity: 3,
        notes: "Incisal edge fracture — composite repair planned",
      },
      { id: "seed_tc_fatima_36_restoration", toothNumber: "36", type: ToothConditionType.RESTORATION, surfaces: ["MO"] },
    ],
  };

  let toothCount = 0;
  let conditionCount = 0;

  for (const [patientNumber, conditions] of Object.entries(charts)) {
    const patient = patients[patientNumber];
    if (!patient) continue;

    const toothNumbers = [...new Set(conditions.map((c) => c.toothNumber))];

    for (const number of toothNumbers) {
      await prisma.tooth.upsert({
        where: { tenantId_patientId_number: { tenantId, patientId: patient.id, number } },
        create: { tenantId, patientId: patient.id, number, notation: ToothNotation.FDI },
        update: {},
      });
      toothCount++;
    }

    for (const c of conditions) {
      const tooth = await prisma.tooth.findUniqueOrThrow({
        where: { tenantId_patientId_number: { tenantId, patientId: patient.id, number: c.toothNumber } },
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
          mobility: c.mobility,
          pocketDepth: c.pocketDepth,
          notes: c.notes,
          recordedBy,
        },
        update: {
          type: c.type,
          surfaces: c.surfaces ?? [],
          severity: c.severity,
          mobility: c.mobility,
          pocketDepth: c.pocketDepth,
          notes: c.notes,
        },
      });
      conditionCount++;
    }
  }

  console.log(`   ✅ ${toothCount} teeth, ${conditionCount} conditions (Gopi + Fatima charts)`);
}

// ─── 7. Appointments ──────────────────────────────────────────────────────────

async function seedAppointments(
  tenantId: string,
  branchId: string,
  patients: Record<string, { id: string; patientNumber: string }>,
  doctors: Record<string, { id: string }>,
  chairs: { id: string; number: number }[],
  providers: { owner: { id: string }; dentist: { id: string } },
) {
  console.log("📅 Seeding appointments…");

  const ownerDoctor = doctors[SEED.users.owner];
  const specialistDoctor = doctors[SEED.users.dentist];
  const chair1 = chairs.find((c) => c.number === 1)!;
  const chair2 = chairs.find((c) => c.number === 2)!;
  const chair3 = chairs.find((c) => c.number === 3)!;

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
    notes?: string;
  };

  const apptDefs: ApptDef[] = [
    // Past
    {
      id: "seed_appt_gopi_scaling_done",
      patientNumber: "P000001",
      title: "Scaling & Polishing",
      daysOffset: -14,
      hour: 9,
      durationMin: 45,
      status: AppointmentStatus.COMPLETED,
      type: "Hygiene",
      doctorId: ownerDoctor?.id,
      providerId: providers.owner.id,
      chairId: chair3.id,
      notes: "Completed — mild calculus lower anteriors",
    },
    {
      id: "seed_appt_rajesh_implant_done",
      patientNumber: "P000003",
      title: "Implant Placement #38",
      daysOffset: -7,
      hour: 11,
      durationMin: 120,
      status: AppointmentStatus.COMPLETED,
      type: "Surgery",
      doctorId: specialistDoctor?.id,
      providerId: providers.dentist.id,
      chairId: chair2.id,
    },
    {
      id: "seed_appt_sarah_noshow",
      patientNumber: "P000004",
      title: "Routine Checkup",
      daysOffset: -5,
      hour: 14,
      durationMin: 30,
      status: AppointmentStatus.NO_SHOW,
      type: "Checkup",
      doctorId: ownerDoctor?.id,
      chairId: chair1.id,
    },
    {
      id: "seed_appt_mohammed_canceled",
      patientNumber: "P000005",
      title: "Crown Delivery #46",
      daysOffset: -2,
      hour: 10,
      durationMin: 45,
      status: AppointmentStatus.CANCELED,
      type: "Restorative",
      doctorId: specialistDoctor?.id,
      chairId: chair2.id,
      notes: "Patient rescheduled — travel conflict",
    },
    // Today / upcoming
    {
      id: "seed_appt_gopi_rct_today",
      patientNumber: "P000001",
      title: "RCT Review + Crown Prep #46",
      daysOffset: 1,
      hour: 10,
      durationMin: 90,
      status: AppointmentStatus.CONFIRMED,
      type: "Endodontics",
      doctorId: specialistDoctor?.id,
      providerId: providers.dentist.id,
      chairId: chair2.id,
    },
    {
      id: "seed_appt_fatima_scaling",
      patientNumber: "P000002",
      title: "Periodontal Scaling — UR Quadrant",
      daysOffset: 2,
      hour: 11,
      durationMin: 45,
      status: AppointmentStatus.SCHEDULED,
      type: "Periodontics",
      doctorId: ownerDoctor?.id,
      chairId: chair1.id,
    },
    {
      id: "seed_appt_mohammed_checkup",
      patientNumber: "P000005",
      title: "Post-RCT Follow-up",
      daysOffset: 3,
      hour: 9,
      durationMin: 30,
      status: AppointmentStatus.SCHEDULED,
      type: "Follow-up",
      doctorId: specialistDoctor?.id,
      chairId: chair2.id,
    },
    {
      id: "seed_appt_priya_new",
      patientNumber: "P000006",
      title: "New Patient Exam + OPG",
      daysOffset: 4,
      hour: 15,
      durationMin: 60,
      status: AppointmentStatus.SCHEDULED,
      type: "New Patient",
      doctorId: ownerDoctor?.id,
      providerId: providers.owner.id,
      chairId: chair1.id,
    },
    {
      id: "seed_appt_rajesh_crown",
      patientNumber: "P000003",
      title: "Implant Crown Impression",
      daysOffset: 7,
      hour: 10,
      durationMin: 45,
      status: AppointmentStatus.CONFIRMED,
      type: "Implants",
      doctorId: specialistDoctor?.id,
      chairId: chair2.id,
    },
    {
      id: "seed_appt_gopi_arrived",
      patientNumber: "P000001",
      title: "Emergency — Sensitivity #26",
      daysOffset: 0,
      hour: 8,
      durationMin: 30,
      status: AppointmentStatus.ARRIVED,
      type: "Emergency",
      doctorId: ownerDoctor?.id,
      chairId: chair1.id,
    },
  ];

  for (const a of apptDefs) {
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
        notes: a.notes,
        reminderSent: a.daysOffset > 0,
      },
      update: {
        title: a.title,
        startTime,
        endTime,
        status: a.status,
        type: a.type,
        notes: a.notes,
      },
    });
  }

  console.log(`   ✅ ${apptDefs.length} appointments (past + upcoming, mixed statuses)`);
}

// ─── 8. Treatment Plans ───────────────────────────────────────────────────────

async function seedTreatmentPlans(
  tenantId: string,
  patients: Record<string, { id: string; patientNumber: string }>,
) {
  console.log("📝 Seeding treatment plans…");

  type PlanDef = {
    id: string;
    patientNumber: string;
    title: string;
    description: string;
    status: TreatmentPlanStatus;
    phase: number;
    totalCost: number;
    acceptedAt?: Date;
    items: {
      id: string;
      procedureCode: string;
      description: string;
      toothNumbers: string[];
      quantity: number;
      unitCost: number;
      totalCost: number;
      phase: number;
      status: string;
    }[];
  };

  const plans: PlanDef[] = [
    {
      id: "seed_tp_gopi_rehab",
      patientNumber: "P000001",
      title: "Full Mouth Rehabilitation — Phase 1",
      description: "Address caries #26, crown #46 post-RCT, monitor implant #48",
      status: TreatmentPlanStatus.IN_PROGRESS,
      phase: 1,
      totalCost: 6450,
      acceptedAt: daysFromNow(-30),
      items: [
        {
          id: "seed_ti_gopi_scaling",
          procedureCode: "D1110",
          description: "Scaling & Polishing",
          toothNumbers: [],
          quantity: 1,
          unitCost: 350,
          totalCost: 350,
          phase: 1,
          status: "completed",
        },
        {
          id: "seed_ti_gopi_filling",
          procedureCode: "D2140",
          description: "Composite Filling #26",
          toothNumbers: ["26"],
          quantity: 1,
          unitCost: 450,
          totalCost: 450,
          phase: 1,
          status: "pending",
        },
        {
          id: "seed_ti_gopi_crown",
          procedureCode: "D2750",
          description: "Porcelain Crown #46",
          toothNumbers: ["46"],
          quantity: 1,
          unitCost: 2800,
          totalCost: 2800,
          phase: 1,
          status: "in_progress",
        },
        {
          id: "seed_ti_gopi_core",
          procedureCode: "D2950",
          description: "Core Buildup #46",
          toothNumbers: ["46"],
          quantity: 1,
          unitCost: 750,
          totalCost: 750,
          phase: 1,
          status: "pending",
        },
      ],
    },
    {
      id: "seed_tp_rajesh_implant",
      patientNumber: "P000003",
      title: "Implant & Crown — #38",
      description: "Replace missing #38 with implant-supported crown",
      status: TreatmentPlanStatus.ACCEPTED,
      phase: 1,
      totalCost: 9700,
      acceptedAt: daysFromNow(-60),
      items: [
        {
          id: "seed_ti_rajesh_implant",
          procedureCode: "D6010",
          description: "Implant Placement #38",
          toothNumbers: ["38"],
          quantity: 1,
          unitCost: 6500,
          totalCost: 6500,
          phase: 1,
          status: "completed",
        },
        {
          id: "seed_ti_rajesh_crown",
          procedureCode: "D6058",
          description: "Implant Crown #38",
          toothNumbers: ["38"],
          quantity: 1,
          unitCost: 3200,
          totalCost: 3200,
          phase: 2,
          status: "pending",
        },
      ],
    },
    {
      id: "seed_tp_fatima_perio",
      patientNumber: "P000002",
      title: "Periodontal Therapy + Restorations",
      description: "Scaling, composite #14, monitor mobility #34",
      status: TreatmentPlanStatus.COMPLETED,
      phase: 1,
      totalCost: 2030,
      acceptedAt: daysFromNow(-90),
      items: [
        {
          id: "seed_ti_fatima_scaling",
          procedureCode: "D4341",
          description: "Periodontal Scaling — UR",
          toothNumbers: ["14", "15", "16", "17", "18"],
          quantity: 1,
          unitCost: 800,
          totalCost: 800,
          phase: 1,
          status: "completed",
        },
        {
          id: "seed_ti_fatima_filling",
          procedureCode: "D2140",
          description: "Composite Filling #14",
          toothNumbers: ["14"],
          quantity: 1,
          unitCost: 450,
          totalCost: 450,
          phase: 1,
          status: "completed",
        },
        {
          id: "seed_ti_fatima_repair",
          procedureCode: "D2140",
          description: "Incisal Composite Repair #44",
          toothNumbers: ["44"],
          quantity: 1,
          unitCost: 450,
          totalCost: 450,
          phase: 1,
          status: "completed",
        },
      ],
    },
  ];

  for (const plan of plans) {
    const patient = patients[plan.patientNumber];
    await prisma.treatmentPlan.upsert({
      where: { id: plan.id },
      create: {
        id: plan.id,
        tenantId,
        patientId: patient.id,
        title: plan.title,
        description: plan.description,
        status: plan.status,
        phase: plan.phase,
        totalCost: plan.totalCost,
        acceptedAt: plan.acceptedAt,
      },
      update: {
        title: plan.title,
        status: plan.status,
        totalCost: plan.totalCost,
      },
    });

    for (const item of plan.items) {
      await prisma.treatmentItem.upsert({
        where: { id: item.id },
        create: { tenantId, treatmentPlanId: plan.id, ...item },
        update: {
          description: item.description,
          status: item.status,
          unitCost: item.unitCost,
          totalCost: item.totalCost,
        },
      });
    }
  }

  console.log(`   ✅ ${plans.length} treatment plans with line items`);
}

// ─── 9. Invoices & Payments ───────────────────────────────────────────────────

async function seedBilling(
  tenantId: string,
  patients: Record<string, { id: string; patientNumber: string }>,
) {
  console.log("💰 Seeding invoices & payments…");

  type InvoiceDef = {
    id: string;
    invoiceNumber: string;
    patientNumber: string;
    status: InvoiceStatus;
    subtotal: number;
    tax: number;
    discount: number;
    total: number;
    dueDateOffset: number;
    notes?: string;
    items: { id: string; description: string; quantity: number; unitPrice: number; total: number; procedureCode?: string }[];
    payments?: { id: string; amount: number; method: PaymentMethod; reference?: string; daysAgo?: number }[];
  };

  const invoices: InvoiceDef[] = [
    {
      id: "seed_inv_gopi_paid",
      invoiceNumber: "INV-2026-001",
      patientNumber: "P000001",
      status: InvoiceStatus.PAID,
      subtotal: 800,
      tax: 40,
      discount: 0,
      total: 840,
      dueDateOffset: -14,
      notes: "Scaling + fluoride varnish",
      items: [
        { id: "seed_ii_gopi_1", description: "Scaling & Polishing (Adult)", quantity: 1, unitPrice: 350, total: 350, procedureCode: "D1110" },
        { id: "seed_ii_gopi_2", description: "Fluoride Varnish", quantity: 1, unitPrice: 180, total: 180, procedureCode: "D1206" },
        { id: "seed_ii_gopi_3", description: "Consultation", quantity: 1, unitPrice: 270, total: 270 },
      ],
      payments: [{ id: "seed_pay_gopi_1", amount: 840, method: PaymentMethod.CARD, reference: "TXN-AD-88421", daysAgo: 14 }],
    },
    {
      id: "seed_inv_rajesh_partial",
      invoiceNumber: "INV-2026-002",
      patientNumber: "P000003",
      status: InvoiceStatus.PARTIAL,
      subtotal: 6500,
      tax: 325,
      discount: 500,
      total: 6325,
      dueDateOffset: 14,
      notes: "Implant surgery — 50% deposit received",
      items: [
        { id: "seed_ii_rajesh_1", description: "Implant — Surgical Placement #38", quantity: 1, unitPrice: 6500, total: 6500, procedureCode: "D6010" },
      ],
      payments: [{ id: "seed_pay_rajesh_1", amount: 3162.5, method: PaymentMethod.BANK_TRANSFER, reference: "WIRE-AD-99201", daysAgo: 7 }],
    },
    {
      id: "seed_inv_mohammed_sent",
      invoiceNumber: "INV-2026-003",
      patientNumber: "P000005",
      status: InvoiceStatus.SENT,
      subtotal: 3550,
      tax: 177.5,
      discount: 0,
      total: 3727.5,
      dueDateOffset: 21,
      items: [
        { id: "seed_ii_moh_1", description: "Root Canal — Molar #46", quantity: 1, unitPrice: 2200, total: 2200, procedureCode: "D3310" },
        { id: "seed_ii_moh_2", description: "Core Buildup #46", quantity: 1, unitPrice: 750, total: 750, procedureCode: "D2950" },
        { id: "seed_ii_moh_3", description: "Consultation & X-rays", quantity: 1, unitPrice: 600, total: 600 },
      ],
    },
    {
      id: "seed_inv_priya_overdue",
      invoiceNumber: "INV-2026-004",
      patientNumber: "P000006",
      status: InvoiceStatus.OVERDUE,
      subtotal: 2200,
      tax: 110,
      discount: 0,
      total: 2310,
      dueDateOffset: -10,
      notes: "Payment reminder sent via SMS",
      items: [
        { id: "seed_ii_priya_1", description: "Root Canal — Anterior #11", quantity: 1, unitPrice: 2200, total: 2200, procedureCode: "D3310" },
      ],
    },
    {
      id: "seed_inv_fatima_paid",
      invoiceNumber: "INV-2025-089",
      patientNumber: "P000002",
      status: InvoiceStatus.PAID,
      subtotal: 1700,
      tax: 85,
      discount: 100,
      total: 1685,
      dueDateOffset: -45,
      items: [
        { id: "seed_ii_fatima_1", description: "Periodontal Scaling — UR Quadrant", quantity: 1, unitPrice: 800, total: 800, procedureCode: "D4341" },
        { id: "seed_ii_fatima_2", description: "Composite Filling #14", quantity: 1, unitPrice: 450, total: 450, procedureCode: "D2140" },
        { id: "seed_ii_fatima_3", description: "Incisal Repair #44", quantity: 1, unitPrice: 450, total: 450, procedureCode: "D2140" },
      ],
      payments: [{ id: "seed_pay_fatima_1", amount: 1685, method: PaymentMethod.CASH, daysAgo: 45 }],
    },
  ];

  for (const inv of invoices) {
    const patient = patients[inv.patientNumber];
    const dueDate = daysFromNow(inv.dueDateOffset);

    await prisma.invoice.upsert({
      where: { tenantId_invoiceNumber: { tenantId, invoiceNumber: inv.invoiceNumber } },
      create: {
        id: inv.id,
        tenantId,
        patientId: patient.id,
        invoiceNumber: inv.invoiceNumber,
        status: inv.status,
        subtotal: inv.subtotal,
        tax: inv.tax,
        discount: inv.discount,
        total: inv.total,
        dueDate,
        notes: inv.notes,
      },
      update: { status: inv.status, total: inv.total, dueDate, notes: inv.notes },
    });

    for (const item of inv.items) {
      await prisma.invoiceItem.upsert({
        where: { id: item.id },
        create: { tenantId, invoiceId: inv.id, ...item },
        update: { description: item.description, total: item.total },
      });
    }

    for (const pay of inv.payments ?? []) {
      await prisma.payment.upsert({
        where: { id: pay.id },
        create: {
          id: pay.id,
          tenantId,
          invoiceId: inv.id,
          amount: pay.amount,
          method: pay.method,
          reference: pay.reference,
          paidAt: daysFromNow(-(pay.daysAgo ?? 0)),
        },
        update: { amount: pay.amount, method: pay.method },
      });
    }
  }

  console.log(`   ✅ ${invoices.length} invoices with items & payments`);
}

// ─── 10. Inventory ────────────────────────────────────────────────────────────

async function seedInventory(tenantId: string) {
  console.log("📦 Seeding inventory & suppliers…");

  const supplier = await prisma.supplier.upsert({
    where: { id: "seed_supplier_dentalpro" },
    create: {
      id: "seed_supplier_dentalpro",
      tenantId,
      name: "DentalPro Supplies UAE",
      email: "orders@dentalpro.ae",
      phone: "+971 4 333 9900",
      address: "Dubai Industrial City, Warehouse 7",
    },
    update: { name: "DentalPro Supplies UAE" },
  });

  const items: Prisma.InventoryItemCreateManyInput[] = [
    { tenantId, supplierId: supplier.id, sku: "GLV-NIT-M", name: "Nitrile Gloves (Medium)", category: "PPE", unit: "box", quantity: 85, reorderLevel: 30, cost: 45, batchNumber: "NP-2026-01" },
    { tenantId, supplierId: supplier.id, sku: "GLV-NIT-L", name: "Nitrile Gloves (Large)", category: "PPE", unit: "box", quantity: 12, reorderLevel: 30, cost: 45, batchNumber: "NP-2026-01" },
    { tenantId, supplierId: supplier.id, sku: "COMP-A2", name: "Composite Resin A2", category: "Restorative", unit: "syringe", quantity: 18, reorderLevel: 10, cost: 120, expiryDate: daysFromNow(180) },
    { tenantId, supplierId: supplier.id, sku: "COMP-A3", name: "Composite Resin A3", category: "Restorative", unit: "syringe", quantity: 8, reorderLevel: 10, cost: 120, expiryDate: daysFromNow(150) },
    { tenantId, supplierId: supplier.id, sku: "ANES-ART", name: "Articaine 4% Cartridges", category: "Anaesthetics", unit: "box", quantity: 24, reorderLevel: 15, cost: 95, expiryDate: daysFromNow(365) },
    { tenantId, supplierId: supplier.id, sku: "BUR-FG-001", name: "Diamond Burs — FG Set", category: "Instruments", unit: "pack", quantity: 6, reorderLevel: 5, cost: 180 },
    { tenantId, supplierId: supplier.id, sku: "IMP-STR-48", name: "Straumann Implant RC 4.8", category: "Implants", unit: "unit", quantity: 3, reorderLevel: 2, cost: 1200 },
    { tenantId, supplierId: supplier.id, sku: "FLR-VAR", name: "Fluoride Varnish 5%", category: "Preventive", unit: "tube", quantity: 5, reorderLevel: 8, cost: 65, expiryDate: daysFromNow(90) },
    { tenantId, supplierId: supplier.id, sku: "SEAL-PIT", name: "Pit & Fissure Sealant", category: "Preventive", unit: "syringe", quantity: 4, reorderLevel: 6, cost: 85 },
    { tenantId, supplierId: supplier.id, sku: "CROWN-TEMP", name: "Temporary Crown Material", category: "Restorative", unit: "cartridge", quantity: 2, reorderLevel: 5, cost: 110 },
  ];

  await prisma.inventoryItem.createMany({ data: items, skipDuplicates: true });

  // Stock transactions for a couple of items (upsert by fixed id)
  const gloveItem = await prisma.inventoryItem.findUnique({
    where: { tenantId_sku: { tenantId, sku: "GLV-NIT-M" } },
  });
  const compositeItem = await prisma.inventoryItem.findUnique({
    where: { tenantId_sku: { tenantId, sku: "COMP-A2" } },
  });

  if (gloveItem) {
    await prisma.stockTransaction.upsert({
      where: { id: "seed_stx_gloves_purchase" },
      create: {
        id: "seed_stx_gloves_purchase",
        tenantId,
        itemId: gloveItem.id,
        type: StockTransactionType.PURCHASE,
        quantity: 50,
        notes: "Monthly PPE restock",
      },
      update: {},
    });
    await prisma.stockTransaction.upsert({
      where: { id: "seed_stx_gloves_usage" },
      create: {
        id: "seed_stx_gloves_usage",
        tenantId,
        itemId: gloveItem.id,
        type: StockTransactionType.USAGE,
        quantity: -5,
        notes: "Clinical usage — week of seed",
      },
      update: {},
    });
  }

  if (compositeItem) {
    await prisma.stockTransaction.upsert({
      where: { id: "seed_stx_composite_usage" },
      create: {
        id: "seed_stx_composite_usage",
        tenantId,
        itemId: compositeItem.id,
        type: StockTransactionType.USAGE,
        quantity: -2,
        notes: "Used for Gopi #26 filling prep",
      },
      update: {},
    });
  }

  console.log(`   ✅ ${items.length} inventory items, supplier + stock transactions`);
}

// ─── 11. Extras (Clinical notes, insurance, recalls, leads) ───────────────────

async function seedExtras(
  tenantId: string,
  patients: Record<string, { id: string; patientNumber: string }>,
  providerId: string,
) {
  console.log("📎 Seeding clinical notes, insurance, recalls & leads…");

  await prisma.clinicalNote.upsert({
    where: { id: "seed_note_gopi_scaling" },
    create: {
      id: "seed_note_gopi_scaling",
      tenantId,
      patientId: patients.P000001.id,
      providerId,
      subjective: "Patient reports sensitivity to cold on lower left. No pain at rest.",
      objective: "Mild calculus LL quadrant. #26 occlusal brown lesion. #46 temp filling intact.",
      assessment: "Reversible pulpitis unlikely; caries #26. Post-RCT #46 ready for crown.",
      plan: "Schedule composite #26. Crown prep #46 next visit. OPG on file.",
      visitDate: daysFromNow(-14),
    },
    update: {},
  });

  await prisma.insurancePolicy.upsert({
    where: { id: "seed_ins_gopi_daman" },
    create: {
      id: "seed_ins_gopi_daman",
      tenantId,
      patientId: patients.P000001.id,
      provider: "Daman Enhanced",
      policyNumber: "DH-8842-2026",
      groupNumber: "EMR-AD-4421",
      coveragePercent: 80,
      annualMax: 15000,
      validFrom: daysFromNow(-365),
      validTo: daysFromNow(365),
      isActive: true,
    },
    update: {},
  });

  await prisma.recall.upsert({
    where: { id: "seed_recall_gopi_hygiene" },
    create: {
      id: "seed_recall_gopi_hygiene",
      tenantId,
      patientId: patients.P000001.id,
      type: "Hygiene Recall",
      dueDate: daysFromNow(166),
      priority: 1,
      churnRisk: RiskLevel.LOW,
      notes: "6-month cleaning due Sep 2026",
    },
    update: {},
  });

  await prisma.recall.upsert({
    where: { id: "seed_recall_fatima_perio" },
    create: {
      id: "seed_recall_fatima_perio",
      tenantId,
      patientId: patients.P000002.id,
      type: "Periodontal Review",
      dueDate: daysFromNow(30),
      priority: 2,
      notes: "Review pocket depths #24",
    },
    update: {},
  });

  await prisma.lead.createMany({
    data: [
      {
        tenantId,
        firstName: "Yusuf",
        lastName: "Al Blooshi",
        email: "y.alblooshi@gmail.com",
        phone: "+971 50 777 8899",
        source: "Google Ads",
        status: LeadStatus.NEW,
        notes: "Interested in teeth whitening",
      },
      {
        tenantId,
        firstName: "Meera",
        lastName: "Krishnan",
        phone: "+971 52 888 9900",
        source: "Referral — Gopi K Unnithan",
        status: LeadStatus.CONTACTED,
        notes: "Callback scheduled",
      },
    ],
    skipDuplicates: true,
  });

  console.log("   ✅ Clinical notes, insurance, recalls, leads");
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("\n🌱 DentaFlow seed starting…\n");

  const tenant = await seedTenant();
  const { branch, chairs } = await seedBranchAndChairs(tenant.id);
  const { doctors, owner, dentist } = await seedStaff(tenant.id, chairs);
  await seedProcedures(tenant.id);
  const patients = await seedPatients(tenant.id);
  await seedOdontogram(tenant.id, patients, owner.id);
  await seedAppointments(tenant.id, branch.id, patients, doctors, chairs, { owner, dentist });
  await seedTreatmentPlans(tenant.id, patients);
  await seedBilling(tenant.id, patients);
  await seedInventory(tenant.id);
  await seedExtras(tenant.id, patients, dentist.id);

  console.log("\n🎉 Seed complete!\n");
  console.log("Summary:");
  console.log(`   🏥 Clinic:     Pearl Dental Centre (${tenant.slug})`);
  console.log(`   🆔 Tenant ID:  ${tenant.id}`);
  console.log(`   👤 Demo pt:    Gopi K Unnithan (P000001)`);
  console.log(`   🦷 Charts:     Gopi + Fatima odontograms`);
  console.log(`   📅 Appts:      10 (completed, scheduled, arrived, no-show, canceled)`);
  console.log(`   💰 Billing:    5 invoices (paid, partial, sent, overdue)`);
  console.log("\n💡 Run again anytime — seed is idempotent.\n");
}

main()
  .catch((error) => {
    console.error("\n❌ Seed failed:\n", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
