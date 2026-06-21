/**
 * prisma/seed.ts — DentaFlow bootstrap seed
 *
 * Requires auth_migration.sql applied first.
 *
 * Usage:
 *   docker exec -i dentaflow-db psql -U dentaflow -d dentaflow < prisma/auth_migration.sql
 *   pnpm prisma generate
 *   pnpm db:seed
 */

import {
  PrismaClient,
  SubscriptionPlan,
  SubscriptionStatus,
  TenantStatus,
  UserRole,
  AppointmentStatus,
  ToothNotation,
} from "@prisma/client";
import { hash } from "bcryptjs";

const db = new PrismaClient();

async function hashPassword(plain: string) {
  return hash(plain, 12);
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

async function main() {
  console.log("🌱  Starting DentaFlow seed...");

  const superAdminAuth = await db.auth_users.upsert({
    where: { email: "superadmin@dentaflow.io" },
    update: { isSuperAdmin: true },
    create: {
      id: "auth_superadmin",
      email: "superadmin@dentaflow.io",
      name: "Platform Admin",
      passwordHash: await hashPassword("DentaFlow@2024!"),
      isSuperAdmin: true,
      emailVerified: new Date(),
    },
  });
  console.log("✓  Super admin:", superAdminAuth.email);

  const ownerAuthA = await db.auth_users.upsert({
    where: { email: "owner@brightsmile.demo" },
    update: {},
    create: {
      id: "auth_owner_a",
      email: "owner@brightsmile.demo",
      name: "Dr. Sarah Mitchell",
      passwordHash: await hashPassword("BrightSmile@123"),
      emailVerified: new Date(),
    },
  });

  const staffAuthA = await db.auth_users.upsert({
    where: { email: "staff@brightsmile.demo" },
    update: {},
    create: {
      id: "auth_staff_a",
      email: "staff@brightsmile.demo",
      name: "James Thornton",
      passwordHash: await hashPassword("Staff@123"),
      emailVerified: new Date(),
    },
  });

  const ownerAuthB = await db.auth_users.upsert({
    where: { email: "owner@pearlwhite.demo" },
    update: {},
    create: {
      id: "auth_owner_b",
      email: "owner@pearlwhite.demo",
      name: "Dr. Amir Hassan",
      passwordHash: await hashPassword("PearlWhite@123"),
      emailVerified: new Date(),
    },
  });

  console.log("✓  Auth users created");

  const tenantA = await db.tenant.upsert({
    where: { slug: "brightsmile-dental" },
    update: {
      subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      status: TenantStatus.ACTIVE,
    },
    create: {
      id: "tenant_a",
      clerkOrgId: "clerk_org_brightsmile",
      name: "BrightSmile Dental",
      slug: "brightsmile-dental",
      status: TenantStatus.ACTIVE,
      subscriptionPlan: SubscriptionPlan.PROFESSIONAL,
      subscriptionStatus: SubscriptionStatus.ACTIVE,
      trialEndsAt: null,
      email: "contact@brightsmile.demo",
      phone: "+1-555-0100",
      address: "123 Dental Ave, San Francisco, CA 94102",
      city: "San Francisco",
      country: "US",
      timezone: "America/Los_Angeles",
      locale: "en",
      onboardingCompleted: true,
    },
  });

  const tenantB = await db.tenant.upsert({
    where: { slug: "pearlwhite-clinic" },
    update: {
      subscriptionPlan: SubscriptionPlan.STARTER,
      subscriptionStatus: SubscriptionStatus.TRIALING,
      status: TenantStatus.ACTIVE,
    },
    create: {
      id: "tenant_b",
      clerkOrgId: "clerk_org_pearlwhite",
      name: "PearlWhite Clinic",
      slug: "pearlwhite-clinic",
      status: TenantStatus.ACTIVE,
      subscriptionPlan: SubscriptionPlan.STARTER,
      subscriptionStatus: SubscriptionStatus.TRIALING,
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
      email: "contact@pearlwhite.demo",
      phone: "+1-555-0200",
      address: "456 Pearl St, New York, NY 10001",
      city: "New York",
      country: "US",
      timezone: "America/New_York",
      locale: "en",
      onboardingCompleted: true,
    },
  });

  console.log("✓  Tenants created:", tenantA.slug, tenantB.slug);

  await db.staffMember.upsert({
    where: { id: "staff_a_owner" },
    update: { authUserId: ownerAuthA.id },
    create: {
      id: "staff_a_owner",
      tenantId: tenantA.id,
      authUserId: ownerAuthA.id,
      clerkUserId: "clerk_owner_a",
      email: "owner@brightsmile.demo",
      firstName: "Sarah",
      lastName: "Mitchell",
      role: UserRole.OWNER,
      isActive: true,
    },
  });

  await db.staffMember.upsert({
    where: { id: "staff_a_member" },
    update: { authUserId: staffAuthA.id },
    create: {
      id: "staff_a_member",
      tenantId: tenantA.id,
      authUserId: staffAuthA.id,
      clerkUserId: "clerk_staff_a",
      email: "staff@brightsmile.demo",
      firstName: "James",
      lastName: "Thornton",
      role: UserRole.HYGIENIST,
      isActive: true,
    },
  });

  await db.staffMember.upsert({
    where: { id: "staff_b_owner" },
    update: { authUserId: ownerAuthB.id },
    create: {
      id: "staff_b_owner",
      tenantId: tenantB.id,
      authUserId: ownerAuthB.id,
      clerkUserId: "clerk_owner_b",
      email: "owner@pearlwhite.demo",
      firstName: "Amir",
      lastName: "Hassan",
      role: UserRole.OWNER,
      isActive: true,
    },
  });

  console.log("✓  StaffMembers created and linked to auth users");

  await db.tenant_memberships.upsert({
    where: { userId_tenantId: { userId: ownerAuthA.id, tenantId: tenantA.id } },
    update: { role: "OWNER", isActive: true },
    create: {
      id: "mem_owner_a",
      userId: ownerAuthA.id,
      tenantId: tenantA.id,
      role: "OWNER",
      isActive: true,
      acceptedAt: new Date(),
    },
  });

  await db.tenant_memberships.upsert({
    where: { userId_tenantId: { userId: staffAuthA.id, tenantId: tenantA.id } },
    update: { role: "MEMBER", isActive: true },
    create: {
      id: "mem_staff_a",
      userId: staffAuthA.id,
      tenantId: tenantA.id,
      role: "MEMBER",
      isActive: true,
      acceptedAt: new Date(),
    },
  });

  await db.tenant_memberships.upsert({
    where: { userId_tenantId: { userId: ownerAuthB.id, tenantId: tenantB.id } },
    update: { role: "OWNER", isActive: true },
    create: {
      id: "mem_owner_b",
      userId: ownerAuthB.id,
      tenantId: tenantB.id,
      role: "OWNER",
      isActive: true,
      acceptedAt: new Date(),
    },
  });

  console.log("✓  TenantMemberships created");

  await db.auth_users.update({
    where: { id: ownerAuthA.id },
    data: { activeTenantId: tenantA.id },
  });
  await db.auth_users.update({
    where: { id: staffAuthA.id },
    data: { activeTenantId: tenantA.id },
  });
  await db.auth_users.update({
    where: { id: ownerAuthB.id },
    data: { activeTenantId: tenantB.id },
  });

  await db.settings.upsert({
    where: { tenantId: tenantA.id },
    create: { tenantId: tenantA.id, currency: "USD", taxRate: 0, defaultNotation: ToothNotation.FDI },
    update: {},
  });
  await db.settings.upsert({
    where: { tenantId: tenantB.id },
    create: { tenantId: tenantB.id, currency: "USD", taxRate: 0, defaultNotation: ToothNotation.FDI },
    update: {},
  });

  const branchA = await db.branch.upsert({
    where: { id: "branch_a_main" },
    update: {},
    create: {
      id: "branch_a_main",
      tenantId: tenantA.id,
      name: "Main Street Branch",
      address: "123 Dental Ave, San Francisco, CA 94102",
      phone: "+1-555-0101",
      isPrimary: true,
    },
  });

  const staffOwnerA = await db.staffMember.findUniqueOrThrow({ where: { id: "staff_a_owner" } });

  const doctorA = await db.doctor.upsert({
    where: { userId: staffOwnerA.id },
    create: {
      tenantId: tenantA.id,
      userId: staffOwnerA.id,
      specialty: "General Dentistry",
      licenseNo: "DDS-CA-001234",
    },
    update: {},
  });

  const chairA = await db.chair.upsert({
    where: { tenantId_branchId_number: { tenantId: tenantA.id, branchId: branchA.id, number: 1 } },
    create: {
      tenantId: tenantA.id,
      branchId: branchA.id,
      name: "Operatory 1",
      number: 1,
      doctorId: doctorA.id,
      isActive: true,
    },
    update: { doctorId: doctorA.id },
  });

  const patients = [
    { id: "patient_a_1", patientNumber: "P000001", firstName: "Emma", lastName: "Williams", dob: "1985-03-15", phone: "+1-555-1001", email: "emma.w@example.com", gender: "Female" },
    { id: "patient_a_2", patientNumber: "P000002", firstName: "Michael", lastName: "Chen", dob: "1990-07-22", phone: "+1-555-1002", email: "m.chen@example.com", gender: "Male" },
    { id: "patient_a_3", patientNumber: "P000003", firstName: "Sofia", lastName: "Rodriguez", dob: "1978-11-08", phone: "+1-555-1003", email: "s.rod@example.com", gender: "Female" },
    { id: "patient_a_4", patientNumber: "P000004", firstName: "James", lastName: "O'Brien", dob: "2005-01-20", phone: "+1-555-1004", email: "james.ob@example.com", gender: "Male" },
    { id: "patient_a_5", patientNumber: "P000005", firstName: "Priya", lastName: "Patel", dob: "1995-09-03", phone: "+1-555-1005", email: "p.patel@example.com", gender: "Female" },
  ];

  const patientRecords: Record<string, { id: string }> = {};

  for (const p of patients) {
    const patient = await db.patient.upsert({
      where: { id: p.id },
      update: {},
      create: {
        id: p.id,
        tenantId: tenantA.id,
        patientNumber: p.patientNumber,
        firstName: p.firstName,
        lastName: p.lastName,
        dateOfBirth: new Date(p.dob),
        phone: p.phone,
        email: p.email,
        gender: p.gender,
        allergies: [],
        medications: [],
      },
    });
    patientRecords[p.patientNumber] = patient;
  }

  console.log("✓  Demo patients created");

  const apptStart = daysFromNow(1, 10);
  await db.appointment.upsert({
    where: { id: "seed_appt_emma_checkup" },
    update: { startTime: apptStart, endTime: addMinutes(apptStart, 45) },
    create: {
      id: "seed_appt_emma_checkup",
      tenantId: tenantA.id,
      patientId: patientRecords.P000001.id,
      branchId: branchA.id,
      doctorId: doctorA.id,
      providerId: staffOwnerA.id,
      chairId: chairA.id,
      title: "Routine Checkup",
      startTime: apptStart,
      endTime: addMinutes(apptStart, 45),
      status: AppointmentStatus.CONFIRMED,
      type: "Checkup",
    },
  });

  console.log(`
✅  Seed complete! Login credentials:

  Super Admin:
    URL:      /login
    Email:    superadmin@dentaflow.io
    Password: DentaFlow@2024!

  BrightSmile Owner (Dr. Sarah Mitchell):
    URL:      /t/brightsmile-dental/dashboard
    Email:    owner@brightsmile.demo
    Password: BrightSmile@123

  BrightSmile Staff (James Thornton):
    Email:    staff@brightsmile.demo
    Password: Staff@123

  PearlWhite Owner (Dr. Amir Hassan):
    URL:      /t/pearlwhite-clinic/dashboard
    Email:    owner@pearlwhite.demo
    Password: PearlWhite@123
  `);
}

main()
  .catch((e) => {
    console.error("❌  Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
