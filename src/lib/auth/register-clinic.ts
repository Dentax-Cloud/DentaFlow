import { auth, clerkClient } from "@/lib/auth/stubs/server";
import { UserRole } from "@prisma/client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { db } from "@/lib/db";
import {
  clinicRegistrationServerSchema,
  formatAdminName,
  type ClinicRegistrationSubmit,
} from "@/lib/auth/registration-schema";
import { getCountryByCode } from "@/lib/auth/countries";
import { sendWelcomeEmail } from "@/lib/mail";
import { ensureStripeCustomer } from "@/lib/tenant/billing";
import { provisionTenantFromWebhook } from "@/lib/tenant/service";
import { getDefaultTrialSubscriptionFields } from "@/lib/tenant/trial";
import { TenantStatus } from "@prisma/client";
export type RegisterClinicResult =
  | { success: true; clerkOrgId: string; tenantId: string }
  | { success: false; error: string };

export async function registerClinic(data: ClinicRegistrationSubmit): Promise<RegisterClinicResult> {
  const parsed = clinicRegistrationServerSchema.safeParse(data);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    const field = firstIssue?.path.join(".") || "form";
    return {
      success: false,
      error: firstIssue?.message ?? `Invalid registration data (${field})`,
    };
  }

  const input = parsed.data;
  const { userId } = await auth();
  if (!userId) {
    return { success: false, error: "You must be signed in to complete registration" };
  }

  try {
    const client = await clerkClient();

    const existingMemberships = await client.users.getOrganizationMembershipList({ userId });
    const existingOrg = existingMemberships.data.find(
      (m) => m.organization.name === input.clinicName,
    );

    let clerkOrgId: string;

    if (existingOrg) {
      clerkOrgId = existingOrg.organization.id;
    } else {
      const org = await client.organizations.createOrganization({
        name: input.clinicName,
        createdBy: userId,
      });
      clerkOrgId = org.id;
    }

    const tenant = await provisionTenantFromWebhook({
      clerkOrgId,
      orgName: input.clinicName,
      clerkUserId: userId,
    });

    const country = getCountryByCode(input.country);
    const fullAddress = [
      input.addressLine1,
      input.addressLine2,
      input.city,
      input.state,
      input.postalCode,
    ]
      .filter(Boolean)
      .join(", ");

    const trialFields = getDefaultTrialSubscriptionFields();
    const existingMetadata =
      tenant.metadata && typeof tenant.metadata === "object"
        ? (tenant.metadata as Record<string, unknown>)
        : {};

    const updatedTenant = await db.tenant.update({
      where: { id: tenant.id },
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

    await db.user.upsert({
      where: {
        tenantId_clerkUserId: { tenantId: tenant.id, clerkUserId: userId },
      },
      create: {
        tenantId: tenant.id,
        clerkUserId: userId,
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        role: UserRole.ADMIN,
        isActive: true,
      },
      update: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
      },
    });

    const existingBranch = await db.branch.findFirst({
      where: { tenantId: tenant.id, isPrimary: true },
    });

    const branch =
      existingBranch ??
      (await db.branch.create({
        data: {
          tenantId: tenant.id,
          name: "Main Office",
          address: fullAddress,
          phone: input.phone,
          isPrimary: true,
        },
      }));

    const existingChairs = await db.chair.count({ where: { tenantId: tenant.id } });
    if (existingChairs === 0) {
      for (let i = 1; i <= input.chairCount; i++) {
        await db.chair.create({
          data: {
            tenantId: tenant.id,
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

    return { success: true, clerkOrgId, tenantId: tenant.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Registration failed";
    return { success: false, error: message };
  }
}
