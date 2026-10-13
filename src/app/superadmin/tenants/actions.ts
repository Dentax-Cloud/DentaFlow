"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { setTenantActive } from "@/lib/super-admin/queries";
import { deleteTenantAccount } from "@/lib/tenant/delete-account";
import {
  SubscriptionPlan,
  SubscriptionStatus,
  TenantStatus,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { isSubscriptionPlan } from "@/lib/subscription/plan-types";
import { db } from "@/lib/db";
import { sendMail, sendWelcomeEmail } from "@/lib/mail";

export async function updateTenantPlan(
  tenantId: string,
  plan: SubscriptionPlan,
  status: SubscriptionStatus,
  options?: {
    extendTrialDays?: number;
    reason?: string;
  },
) {
  await requireSuperAdmin();

  const trialEndsAt = options?.extendTrialDays
    ? new Date(Date.now() + options.extendTrialDays * 24 * 60 * 60 * 1000)
    : undefined;

  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: {
      subscriptionPlan: plan,
      subscriptionStatus: status,
      ...(trialEndsAt ? { trialEndsAt } : {}),
      ...(status === SubscriptionStatus.CANCELED
        ? { status: TenantStatus.CLOSED }
        : status === SubscriptionStatus.ACTIVE ||
            status === SubscriptionStatus.TRIALING
          ? { status: TenantStatus.ACTIVE }
          : {}),
    },
  });

  await db.auditLog
    .create({
      data: {
        tenantId,
        action: "UPDATE",
        entity: "Tenant",
        entityId: tenantId,
        metadata: {
          type: "PLAN_UPDATED",
          plan,
          status,
          reason: options?.reason ?? "Manual update by superadmin",
          extendTrialDays: options?.extendTrialDays,
        },
      },
    })
    .catch(() => null);

  if (tenant.email) {
    const baseUrl =
      process.env.NEXTAUTH_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      "http://localhost:3000";

    await sendMail({
      to: tenant.email,
      subject: `Your DentaFlow plan has been updated — ${tenant.name}`,
      text: `Your DentaFlow subscription for ${tenant.name} has been updated.

Plan: ${plan}
Status: ${status}
${trialEndsAt ? `Trial extended until: ${trialEndsAt.toLocaleDateString()}` : ""}
${options?.reason ? `Note: ${options.reason}` : ""}

Log in to your dashboard: ${baseUrl}/login`,
    }).catch(() => null);
  }

  revalidatePath("/superadmin/tenants");
  revalidatePath(`/superadmin/tenants/${tenantId}`);
  return tenant;
}

export async function updatePlanAction(tenantId: string, plan: SubscriptionPlan) {
  return updateTenantPlan(tenantId, plan, SubscriptionStatus.ACTIVE);
}

export async function updateStatusAction(tenantId: string, status: SubscriptionStatus) {
  const existing = await db.tenant.findUnique({
    where: { id: tenantId },
    select: { subscriptionPlan: true },
  });
  if (!existing) throw new Error("Tenant not found");
  return updateTenantPlan(tenantId, existing.subscriptionPlan, status);
}

export async function suspendTenantAction(
  tenantId: string,
  _formData?: FormData,
): Promise<void> {
  await requireSuperAdmin();

  const tenant = await setTenantActive(tenantId, false);

  if (tenant.email) {
    await sendMail({
      to: tenant.email,
      subject: "Your DentaFlow account has been suspended",
      text: `Your DentaFlow account for ${tenant.name} has been suspended.

Please contact support to resolve this issue.
Support: support@dentaflow.io`,
    }).catch((err) => console.error("[suspendTenant] email failed:", err));
  }

  revalidatePath("/superadmin/tenants");
  revalidatePath(`/superadmin/tenants/${tenantId}`);
}

export async function reinstateTenantAction(
  tenantId: string,
  _formData?: FormData,
): Promise<void> {
  await requireSuperAdmin();

  const tenant = await setTenantActive(tenantId, true);

  if (tenant.email) {
    const baseUrl =
      process.env.NEXTAUTH_URL?.trim() ||
      process.env.NEXT_PUBLIC_APP_URL?.trim() ||
      "http://localhost:3000";

    await sendMail({
      to: tenant.email,
      subject: "Your DentaFlow account has been reinstated",
      text: `Good news! Your DentaFlow account for ${tenant.name} has been reinstated.

You can now log in at: ${baseUrl}/login`,
    }).catch((err) => console.error("[reinstateTenant] email failed:", err));
  }

  revalidatePath("/superadmin/tenants");
  revalidatePath(`/superadmin/tenants/${tenantId}`);
}

/**
 * Permanently closes a tenant/clinic account (soft delete): hides it from
 * every normal query, deactivates its staff/memberships, and frees its
 * owner's registration email so the same address can sign up again. See
 * `deleteTenantAccount` for exactly what this does and does not remove.
 */
export async function deleteTenantAccountAction(
  tenantId: string,
  _formData?: FormData,
): Promise<void> {
  await requireSuperAdmin();

  const tenant = await deleteTenantAccount(tenantId);

  await db.auditLog
    .create({
      data: {
        tenantId,
        action: "DELETE",
        entity: "Tenant",
        entityId: tenantId,
        metadata: {
          type: "TENANT_ACCOUNT_DELETED",
          tenantName: tenant.name,
          reason: "Deleted by superadmin — account closed, owner email freed for re-registration",
        },
      },
    })
    .catch(() => null);

  revalidatePath("/superadmin/tenants");
  revalidatePath(`/superadmin/tenants/${tenantId}`);
}

/** Form action wrapper for plan updates from the tenants table. */
export async function updateTenantPlanForm(tenantId: string, formData: FormData) {
  const plan = formData.get("plan");
  if (typeof plan !== "string" || !isSubscriptionPlan(plan)) {
    throw new Error("INVALID_PLAN");
  }
  return updatePlanAction(tenantId, plan);
}

/** Form action wrapper for subscription status updates from the tenants table. */
export async function updateTenantStatusForm(tenantId: string, formData: FormData) {
  const status = formData.get("status");
  if (
    typeof status !== "string" ||
    !(Object.values(SubscriptionStatus) as string[]).includes(status)
  ) {
    throw new Error("INVALID_STATUS");
  }
  return updateStatusAction(tenantId, status as SubscriptionStatus);
}

export async function approveTenantAction(
  tenantId: string,
  _formData?: FormData,
): Promise<void> {
  await requireSuperAdmin();

  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: { status: TenantStatus.ACTIVE },
    select: { id: true, name: true, email: true },
  });

  await db.tenantApprovalRequest.updateMany({
    where: { tenantId, status: "PENDING" },
    data: { status: "APPROVED" },
  });

  if (tenant.email) {
    await sendWelcomeEmail({
      to: tenant.email,
      clinicName: tenant.name,
      adminName: tenant.name,
      trialDays: 14,
    }).catch((err) => console.error("[approveTenant] welcome email failed:", err));
  }

  revalidatePath("/superadmin/tenants");
  revalidatePath(`/superadmin/tenants/${tenantId}`);
}

export async function rejectTenantAction(
  tenantId: string,
  _formData?: FormData,
): Promise<void> {
  await requireSuperAdmin();

  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: { status: TenantStatus.CLOSED },
    select: { id: true, name: true, email: true },
  });

  await db.tenantApprovalRequest.updateMany({
    where: { tenantId, status: "PENDING" },
    data: { status: "REJECTED" },
  });

  if (tenant.email) {
    await sendMail({
      to: tenant.email,
      subject: `DentaFlow registration — ${tenant.name}`,
      text: `Thank you for your interest in DentaFlow. Unfortunately we were unable to approve ${tenant.name} at this time.`,
    }).catch((err) => console.error("[rejectTenant] email failed:", err));
  }

  revalidatePath("/superadmin/tenants");
}
