"use server";

import { requireSuperAdmin } from "@/lib/auth";
import {
  updateTenantPlan,
  updateTenantStatus,
  setTenantActive,
} from "@/lib/super-admin/queries";
import { SubscriptionPlan, SubscriptionStatus, TenantStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { isSubscriptionPlan } from "@/lib/subscription/plan-types";
import { db } from "@/lib/db";
import { sendMail, sendWelcomeEmail } from "@/lib/mail";

export async function updatePlanAction(tenantId: string, plan: SubscriptionPlan) {
  await requireSuperAdmin();

  await updateTenantPlan(tenantId, plan);
  revalidatePath("/superadmin/tenants");
  return { success: true };
}

export async function updateStatusAction(tenantId: string, status: SubscriptionStatus) {
  await requireSuperAdmin();

  await updateTenantStatus(tenantId, status);
  revalidatePath("/superadmin/tenants");
  return { success: true };
}

export async function suspendTenantAction(tenantId: string) {
  await requireSuperAdmin();

  await setTenantActive(tenantId, false);
  revalidatePath("/superadmin/tenants");
  return { success: true };
}

export async function reinstateTenantAction(tenantId: string) {
  await requireSuperAdmin();

  await setTenantActive(tenantId, true);
  revalidatePath("/superadmin/tenants");
  return { success: true };
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

export async function approveTenantAction(tenantId: string) {
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
  return { success: true };
}

export async function rejectTenantAction(tenantId: string, notes?: string) {
  await requireSuperAdmin();

  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: { status: TenantStatus.CLOSED },
    select: { id: true, name: true, email: true },
  });

  await db.tenantApprovalRequest.updateMany({
    where: { tenantId, status: "PENDING" },
    data: { status: "REJECTED", notes },
  });

  if (tenant.email) {
    await sendMail({
      to: tenant.email,
      subject: `DentaFlow registration — ${tenant.name}`,
      text: `Thank you for your interest in DentaFlow. Unfortunately we were unable to approve ${tenant.name} at this time.${notes ? `\n\nReason: ${notes}` : ""}`,
    }).catch((err) => console.error("[rejectTenant] email failed:", err));
  }

  revalidatePath("/superadmin/tenants");
  return { success: true };
}
