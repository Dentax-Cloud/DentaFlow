"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import type { ClinicType } from "@/lib/clinic-type";

export async function setClinicType(clinicType: ClinicType) {
  const ctx = await requireTenantContext();
  if (!ctx.staffMember) {
    return { success: false as const, error: "Not authorized" };
  }

  const value = clinicType === "solo" ? "solo" : "practice";

  await db.tenant.update({
    where: { id: ctx.tenantId },
    data: { clinicType: value },
  });

  revalidatePath("/");
  revalidatePath("/solo");
  revalidatePath("/dashboard");

  return { success: true as const, clinicType: value };
}
