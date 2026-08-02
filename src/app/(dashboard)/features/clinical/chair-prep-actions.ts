"use server";

import { revalidatePath } from "next/cache";
import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import { loadChairPrepForDay } from "@/lib/encounter/chair-prep";
import { db } from "@/lib/db";

async function requireChairPrepWrite() {
  const ctx = await requireTenantContext();
  const role = ctx.staffMember?.role;
  if (role && hasPermission(role, PERMISSIONS.clinical_chart.write)) {
    await requirePermission(PERMISSIONS.clinical_chart.write);
  } else {
    await requirePermission(PERMISSIONS.clinical_assist.write);
  }
  if (!isEncounterSpineEnabled(ctx.tenant)) throw new Error("Encounter spine is not enabled for this clinic.");
  if (!ctx.staffMember?.id) throw new Error("Staff member required.");
  return ctx;
}

export async function loadChairPrep(clinicDateYmd: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);
  if (!isEncounterSpineEnabled(ctx.tenant)) throw new Error("Encounter spine is not enabled for this clinic.");
  return loadChairPrepForDay(ctx.tenantId, clinicDateYmd, ctx.tenant.timezone);
}

export async function setChairPrepared(input: { chairId: string; prepDate: string; prepared: boolean }) {
  const ctx = await requireChairPrepWrite();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.prepDate)) {
    throw new Error("Prep date must be YYYY-MM-DD.");
  }
  const chair = await db.chair.findFirst({
    where: { id: input.chairId, tenantId: ctx.tenantId },
    select: { id: true },
  });
  if (!chair) throw new Error("Chair not found.");
  const staffId = ctx.staffMember!.id;
  if (input.prepared) {
    await db.chairPrepDay.upsert({
      where: {
        tenantId_chairId_prepDate: {
          tenantId: ctx.tenantId,
          chairId: input.chairId,
          prepDate: input.prepDate,
        },
      },
      create: {
        tenantId: ctx.tenantId,
        chairId: input.chairId,
        prepDate: input.prepDate,
        preparedAt: new Date(),
        preparedByStaffId: staffId,
      },
      update: { preparedAt: new Date(), preparedByStaffId: staffId },
    });
  } else {
    await db.chairPrepDay.updateMany({
      where: {
        tenantId: ctx.tenantId,
        chairId: input.chairId,
        prepDate: input.prepDate,
      },
      data: { preparedAt: null, preparedByStaffId: null },
    });
  }
  revalidatePath("/clinical/chair-prep");
}
