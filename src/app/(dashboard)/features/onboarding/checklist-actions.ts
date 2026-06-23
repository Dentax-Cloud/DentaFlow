"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import {
  getOnboardingChecklist,
  markOnboardingComplete,
  skipOnboardingChecklist,
} from "@/lib/tenant/onboarding";

export async function getOnboardingChecklistState() {
  const ctx = await requireTenantContext();
  return getOnboardingChecklist(ctx.tenant);
}

export async function skipOnboardingChecklistAction() {
  const ctx = await requireTenantContext();
  await skipOnboardingChecklist(ctx.tenantId);
  revalidatePath("/dashboard");
  revalidatePath("/onboarding/checklist");
  return { success: true };
}

export async function syncOnboardingCompletionAction() {
  const ctx = await requireTenantContext();
  const state = await getOnboardingChecklist(ctx.tenant);
  if (state.allComplete) {
    await markOnboardingComplete(ctx.tenantId);
    revalidatePath("/dashboard");
  }
  return { success: true, allComplete: state.allComplete };
}
