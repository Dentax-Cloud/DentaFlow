import { getServerAuthSession } from "@/lib/auth";
import { randomUUID } from "crypto";
import { UserRole, TenantStatus } from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  clinicRegistrationServerSchema,
  formatAdminName,
  type ClinicRegistrationSubmit,
} from "@/lib/auth/registration-schema";
import { getCountryByCode } from "@/lib/auth/countries";
import { sendWelcomeEmail } from "@/lib/mail";
import { ensureStripeCustomer } from "@/lib/tenant/billing";
import { provisionTenant } from "@/lib/tenant/service";
import { getDefaultTrialSubscriptionFields } from "@/lib/tenant/trial";

export type RegisterClinicResult =
  | {
      success: true;
      tenantId: string;
      tenantSlug: string;
      authUserId: string;
    }
  | { success: false; error: string; field?: string };

function buildFullAddress(input: ClinicRegistrationSubmit) {
  return [
    input.addressLine1,
    input.addressLine2,
    input.city,
    input.state,
    input.postalCode,
  ]
    .filter(Boolean)
    .join(", ");
}

async function finalizeClinicSetup(
  tenantId: string,
  staffMemberId: string,
  input: ClinicRegistrationSubmit,
) {
  const country = getCountryByCode(input.country);
  const fullAddress = buildFullAddress(input);
  const trialFields = getDefaultTrialSubscriptionFields();
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  const existingMetadata =
    tenant?.metadata && typeof tenant.metadata === "object"
      ? (tenant.metadata as Record<string, unknown>)
      : {};

  const updatedTenant = await db.tenant.update({
    where: { id: tenantId },
    data: {
      name: input.clinicName,
      email: input.email,
      phone: input.phone,
      address: fullAddress,
      city: input.city,
      country: input.country,
      timezone: input.timezone,
      logoUrl: input.logoUrl || undefined,
      subscriptionPlan: SubscriptionPlan.STARTER,
      subscriptionStatus: trialFields.subscriptionStatus,
      trialEndsAt: trialFields.trialEndsAt,
      onboardingCompleted: true,
      metadata: {
        ...existingMetadata,
        currency: input.currency,
        specialties: input.specialties,
        expectedMonthlyPatients: input.expectedMonthlyPatients,
        referralSource: input.referralSource,
        doctorCount: input.doctorCount,
        addressLine1: input.addressLine1,
        addressLine2: input.addressLine2,
        state: input.state,
        postalCode: input.postalCode,
        ...(input.taxId
          ? {
              taxId: input.taxId,
              taxIdType: country?.taxLabel ?? "Tax ID",
            }
          : {}),
      },
    },
  });

  await db.staffMember.update({
    where: { id: staffMemberId },
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
    },
  });

  const branch =
    (await db.branch.findFirst({
      where: { tenantId, isPrimary: true },
    })) ??
    (await db.branch.create({
      data: {
        tenantId,
        name: "Main Office",
        address: fullAddress,
        phone: input.phone,
        isPrimary: true,
      },
    }));

  const existingChairs = await db.chair.count({ where: { tenantId } });
  if (existingChairs === 0) {
    for (let i = 1; i <= input.chairCount; i++) {
      await db.chair.create({
        data: {
          tenantId,
          branchId: branch.id,
          name: `Operatory ${i}`,
          number: i,
        },
      });
    }
  }

  if (updatedTenant.status === TenantStatus.ACTIVE) {
    await ensureStripeCustomer(updatedTenant);
  }

  await sendWelcomeEmail({
    to: input.email,
    clinicName: input.clinicName,
    adminName: formatAdminName(input.firstName, input.lastName),
    trialDays: 14,
  }).catch((err) => console.error("[mail:welcome]", err));

  return updatedTenant;
}

async function registerClinicNextAuth(
  input: ClinicRegistrationSubmit,
): Promise<RegisterClinicResult> {
  if (!input.password) {
    return { success: false, error: "Password is required", field: "password" };
  }

  const email = input.email.toLowerCase().trim();
  const existing = await db.auth_users.findUnique({ where: { email } });
  if (existing) {
    return {
      success: false,
      error: "An account with this email already exists",
      field: "email",
    };
  }

  const passwordHash = await bcrypt.hash(input.password, 12);
  const ownerName = formatAdminName(input.firstName, input.lastName);
  const fullAddress = buildFullAddress(input);

  const authUser = await db.auth_users.create({
    data: {
      id: `auth_${randomUUID()}`,
      email,
      name: ownerName,
      passwordHash,
    },
  });

  let provisionResult: Awaited<ReturnType<typeof provisionTenant>>;
  try {
    provisionResult = await provisionTenant({
      ownerAuthUserId: authUser.id,
      ownerName,
      ownerEmail: email,
      clinicName: input.clinicName,
      clinicEmail: input.email,
      phone: input.phone,
      address: fullAddress,
      timezone: input.timezone,
    });
  } catch (err) {
    await db.auth_users.delete({ where: { id: authUser.id } }).catch(() => null);
    console.error("[registerClinic] provisioning failed:", err);
    return { success: false, error: "Failed to create clinic. Please try again." };
  }

  try {
    const updatedTenant = await finalizeClinicSetup(
      provisionResult.tenant.id,
      provisionResult.staffMember.id,
      input,
    );

    await db.auth_users.update({
      where: { id: authUser.id },
      data: { activeTenantId: updatedTenant.id },
    });

    return {
      success: true,
      tenantId: updatedTenant.id,
      tenantSlug: updatedTenant.slug,
      authUserId: authUser.id,
    };
  } catch (err) {
    console.error("[registerClinic] finalize failed:", err);
    return { success: false, error: "Failed to complete clinic setup. Please try again." };
  }
}

async function registerClinicForExistingUser(
  input: ClinicRegistrationSubmit,
  authUserId: string,
): Promise<RegisterClinicResult> {
  const authUser = await db.auth_users.findUnique({ where: { id: authUserId } });
  if (!authUser) {
    return { success: false, error: "Account not found" };
  }

  const ownerName = formatAdminName(input.firstName, input.lastName);
  const fullAddress = buildFullAddress(input);

  let provisionResult: Awaited<ReturnType<typeof provisionTenant>>;
  try {
    provisionResult = await provisionTenant({
      ownerAuthUserId: authUserId,
      ownerName,
      ownerEmail: input.email,
      clinicName: input.clinicName,
      clinicEmail: input.email,
      phone: input.phone,
      address: fullAddress,
      timezone: input.timezone,
    });
  } catch (err) {
    console.error("[registerClinic] provisioning failed:", err);
    return { success: false, error: "Failed to create clinic. Please try again." };
  }

  try {
    const updatedTenant = await finalizeClinicSetup(
      provisionResult.tenant.id,
      provisionResult.staffMember.id,
      input,
    );

    await db.auth_users.update({
      where: { id: authUserId },
      data: { activeTenantId: updatedTenant.id },
    });

    return {
      success: true,
      tenantId: updatedTenant.id,
      tenantSlug: updatedTenant.slug,
      authUserId,
    };
  } catch (err) {
    console.error("[registerClinic] finalize failed:", err);
    return { success: false, error: "Failed to complete clinic setup. Please try again." };
  }
}

export async function registerClinic(data: ClinicRegistrationSubmit): Promise<RegisterClinicResult> {
  const parsed = clinicRegistrationServerSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path.join(".") || "form";
    return {
      success: false,
      error: firstIssue?.message ?? `Invalid registration data (${field})`,
      field,
    };
  }

  const input = parsed.data;
  const session = await getServerAuthSession();
  const userId = session?.user?.id ?? null;

  if (!userId && input.password) {
    return registerClinicNextAuth(input);
  }

  if (userId) {
    return registerClinicForExistingUser(input, userId);
  }

  return { success: false, error: "Password is required to create an account" };
}
