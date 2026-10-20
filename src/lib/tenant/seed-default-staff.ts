/**
 * Seed default clinic staff users when a new tenant is provisioned.
 *
 * Creates RECEPTIONIST, NURSE, DOCTOR, STORE login accounts with predictable
 * emails so clinics can start training / demo without inviting each role first.
 *
 * Security:
 * - Opt-out via SEED_DEFAULT_STAFF_USERS=false
 * - Password from DEFAULT_STAFF_SEED_PASSWORD or a per-tenant random temp
 * - Credentials stored once on tenant.metadata.seededStaff (for onboarding UI)
 * - auth_users has no mustChangePassword field; owner should rotate via Admin
 */

import { randomBytes, randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { UserRole, type Tenant } from "@prisma/client";
import { db } from "@/lib/db";
import { generateStaffRef } from "@/lib/ids/generate-ids";
import {
  ensureDefaultDoctorSchedule,
  isScheduleClinicalRole,
} from "@/lib/appointments/default-doctor-schedule";

export type SeededStaffCredential = {
  role: UserRole;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  staffMemberId: string;
};

type StaffPackEntry = {
  role: UserRole;
  localPart: string;
  firstName: string;
  lastName: string;
};

/** Canonical starter pack — matches invitable clinical/ops roles. */
export const DEFAULT_STAFF_PACK: readonly StaffPackEntry[] = [
  {
    role: UserRole.RECEPTIONIST,
    localPart: "receptionist",
    firstName: "Reception",
    lastName: "Desk",
  },
  {
    role: UserRole.NURSE,
    localPart: "nurse",
    firstName: "Clinic",
    lastName: "Nurse",
  },
  {
    role: UserRole.DOCTOR,
    localPart: "doctor",
    firstName: "Clinic",
    lastName: "Doctor",
  },
  {
    role: UserRole.STORE,
    localPart: "store",
    firstName: "Store",
    lastName: "Keeper",
  },
] as const;

const SEEDED_META_KEY = "seededStaff";

function envAllowsSeed(): boolean {
  const flag = process.env.SEED_DEFAULT_STAFF_USERS?.trim().toLowerCase();
  if (flag === "false" || flag === "0" || flag === "off") return false;
  return true;
}

function sanitizeSlug(slug: string): string {
  return slug
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

function buildStaffEmail(localPart: string, tenantSlug: string): string {
  const domain =
    process.env.DEFAULT_STAFF_SEED_EMAIL_DOMAIN?.trim() || "staff.dentaflow.io";
  return `${localPart}.${sanitizeSlug(tenantSlug)}@${domain}`;
}

function resolveTempPassword(_tenantId: string): string {
  const fromEnv = process.env.DEFAULT_STAFF_SEED_PASSWORD?.trim();
  if (fromEnv && fromEnv.length >= 8) return fromEnv;
  // Per-tenant readable temp password (not a login secret forever).
  const suffix = randomBytes(3).toString("hex");
  return `Welcome-${suffix}!`;
}

function parseMetadata(raw: Tenant["metadata"]): Record<string, unknown> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return { ...(raw as Record<string, unknown>) };
}

/**
 * Idempotent: skips roles whose email already exists on auth_users or staff.
 * Safe to call multiple times; only creates missing roles.
 */
export async function seedDefaultStaffUsers(
  tenant: Tenant,
): Promise<SeededStaffCredential[]> {
  if (!envAllowsSeed()) return [];

  const password = resolveTempPassword(tenant.id);
  const passwordHash = await bcrypt.hash(password, 12);
  const created: SeededStaffCredential[] = [];

  for (const entry of DEFAULT_STAFF_PACK) {
    const email = buildStaffEmail(entry.localPart, tenant.slug);

    const existingAuth = await db.auth_users.findUnique({ where: { email } });
    if (existingAuth) continue;

    const existingStaff = await db.staffMember.findFirst({
      where: { tenantId: tenant.id, email, deletedAt: null },
    });
    if (existingStaff) continue;

    const authUserId = `auth_${randomUUID()}`;
    const staffRef = await generateStaffRef(tenant.id, entry.role);

    const authUser = await db.auth_users.create({
      data: {
        id: authUserId,
        email,
        name: `${entry.firstName} ${entry.lastName}`,
        passwordHash,
        emailVerified: new Date(),
        activeTenantId: tenant.id,
      },
    });

    await db.tenant_memberships.create({
      data: {
        id: randomUUID(),
        userId: authUser.id,
        tenantId: tenant.id,
        role: entry.role,
        isActive: true,
        acceptedAt: new Date(),
      },
    });

    const staffMember = await db.staffMember.create({
      data: {
        tenantId: tenant.id,
        authUserId: authUser.id,
        email,
        firstName: entry.firstName,
        lastName: entry.lastName,
        role: entry.role,
        staffRef,
        isActive: true,
      },
    });

    if (entry.role === UserRole.DOCTOR || entry.role === UserRole.DENTIST) {
      const existingDoctor = await db.doctor.findUnique({
        where: { userId: staffMember.id },
      });
      if (!existingDoctor) {
        await db.doctor.create({
          data: {
            tenantId: tenant.id,
            userId: staffMember.id,
            specialty: "General Dentistry",
          },
        });
      }
    }

    if (isScheduleClinicalRole(entry.role)) {
      await ensureDefaultDoctorSchedule(tenant.id, staffMember.id);
    }

    created.push({
      role: entry.role,
      email,
      password,
      firstName: entry.firstName,
      lastName: entry.lastName,
      staffMemberId: staffMember.id,
    });
  }

  if (created.length > 0) {
    const meta = parseMetadata(tenant.metadata);
    const prior =
      meta[SEEDED_META_KEY] &&
      typeof meta[SEEDED_META_KEY] === "object" &&
      !Array.isArray(meta[SEEDED_META_KEY])
        ? (meta[SEEDED_META_KEY] as Record<string, unknown>)
        : {};

    await db.tenant.update({
      where: { id: tenant.id },
      data: {
        metadata: {
          ...meta,
          [SEEDED_META_KEY]: {
            ...prior,
            seededAt: new Date().toISOString(),
            // Plain passwords only for first-time owner display; rotate in production.
            credentials: created.map((c) => ({
              role: c.role,
              email: c.email,
              password: c.password,
              staffMemberId: c.staffMemberId,
            })),
          },
        },
      },
    });
  }

  return created;
}

/** Read one-time credentials from tenant metadata (for onboarding UI). */
export function readSeededStaffCredentials(
  tenant: Tenant,
): Array<{ role: string; email: string; password: string }> {
  const meta = parseMetadata(tenant.metadata);
  const block = meta[SEEDED_META_KEY];
  if (!block || typeof block !== "object" || Array.isArray(block)) return [];
  const credentials = (block as Record<string, unknown>).credentials;
  if (!Array.isArray(credentials)) return [];
  return credentials
    .filter(
      (c): c is { role: string; email: string; password: string } =>
        !!c &&
        typeof c === "object" &&
        typeof (c as { email?: unknown }).email === "string" &&
        typeof (c as { password?: unknown }).password === "string",
    )
    .map((c) => ({
      role: String((c as { role?: string }).role ?? ""),
      email: c.email,
      password: c.password,
    }));
}
