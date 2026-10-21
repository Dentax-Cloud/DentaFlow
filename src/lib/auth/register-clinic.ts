import { getServerAuthSession } from "@/lib/auth";
import { randomUUID } from "crypto";
import { UserRole, TenantStatus } from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import {
  clinicRegistrationServerSchema,
  formatAdminName,
  doctorCountFromBand,
  type ClinicRegistrationSubmit,
} from "@/lib/auth/registration-schema";
import { getCountryByCode } from "@/lib/auth/countries";
import { sendWelcomeEmail, sendMail } from "@/lib/mail";
import { ensureStripeCustomer } from "@/lib/tenant/billing";
import { provisionTenant } from "@/lib/tenant/service";
import { syncTenantCountryProfile } from "@/lib/tenant/sync-country-profile";
import { getDefaultTrialSubscriptionFields } from "@/lib/tenant/trial";
import { isEmailVerificationRequired } from "@/lib/auth/email-verification-config";

export type RegisterClinicResult =
  | {
      success: true;
      tenantId: string;
      tenantSlug: string;
      authUserId: string;
      redirectUrl: "/dashboard";
      /** True when the credentials sign-in gate will block this account until it verifies its email. */
      requiresEmailVerification: boolean;
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

export async function sendEmailVerification(email: string) {
  const verificationToken = randomUUID();
  await db.verification_tokens.create({
    data: {
      identifier: email,
      token: verificationToken,
      expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });

  const baseUrl =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  await sendMail({
    to: email,
    subject: "Verify your DentaFlow email address",
    text: `Please verify your email address by clicking the link below:

${baseUrl}/verify-email?token=${verificationToken}

This link expires in 24 hours.`,
  }).catch((err) => console.error("[mail:verify]", err));
}

async function notifySuperAdminsOfRegistration(params: {
  clinicName: string;
  ownerName: string;
  email: string;
}) {
  const superAdmins = await db.auth_users.findMany({
    where: { isSuperAdmin: true },
    select: { email: true },
  });

  const baseUrl =
    process.env.NEXTAUTH_URL?.trim() ||
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    "http://localhost:3000";

  for (const admin of superAdmins) {
    if (!admin.email) continue;
    await sendMail({
      to: admin.email,
      subject: `New clinic registered: ${params.clinicName}`,
      text: `A new clinic has registered on DentaFlow.

Clinic: ${params.clinicName}
Owner: ${params.ownerName} (${params.email})
Plan: STARTER (14-day trial)
Registered: ${new Date().toLocaleString()}

Review at: ${baseUrl}/superadmin/tenants`,
    }).catch(() => null);
  }
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
      onboardingCompleted: false,
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
          name: `Chair ${i}`,
          number: i,
        },
      });
    }
  }

  await ensureStripeCustomer(updatedTenant);

  await syncTenantCountryProfile(tenantId, input.country, {
    secondaryLanguage: input.secondaryLanguage ?? null,
  });

  await db.settings.update({
    where: { tenantId },
    data: {
      currency: input.currency,
      taxRate: input.currency === "AED" ? 5 : 0,
    },
  });

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

  await sendEmailVerification(email);

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
      countryCode: input.country,
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

    await notifySuperAdminsOfRegistration({
      clinicName: input.clinicName,
      ownerName,
      email,
    });

    return {
      success: true,
      tenantId: updatedTenant.id,
      tenantSlug: updatedTenant.slug,
      authUserId: authUser.id,
      redirectUrl: "/dashboard",
      requiresEmailVerification: isEmailVerificationRequired(),
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
      countryCode: input.country,
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
      redirectUrl: "/dashboard",
      requiresEmailVerification: false,
    };
  } catch (err) {
    console.error("[registerClinic] finalize failed:", err);
    return { success: false, error: "Failed to complete clinic setup. Please try again." };
  }
}

export async function registerClinic(data: ClinicRegistrationSubmit): Promise<RegisterClinicResult> {
  const normalized = {
    ...data,
    phone: data.phone?.trim() || "Not provided",
    specialties:
      data.specialties && data.specialties.length > 0
        ? data.specialties
        : data.specialty
          ? [data.specialty]
          : undefined,
    doctorCount: data.doctorCount ?? doctorCountFromBand(data.doctorCountBand),
    addressLine1: data.addressLine1?.trim() || "Address pending",
    city: data.city?.trim() || "City pending",
  };

  const parsed = clinicRegistrationServerSchema.safeParse(normalized);
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
