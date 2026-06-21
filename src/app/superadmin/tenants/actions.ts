"use server";

import { requireSuperAdmin } from "@/lib/auth";
import {
  updateTenantPlan,
  updateTenantStatus,
  setTenantActive,
} from "@/lib/super-admin/queries";
import { SubscriptionPlan, SubscriptionStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { isSubscriptionPlan } from "@/lib/subscription/plan-types";

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
