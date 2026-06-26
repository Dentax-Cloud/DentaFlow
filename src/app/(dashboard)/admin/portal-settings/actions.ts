"use server";

import { db } from "@/lib/db";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { revalidatePath } from "next/cache";

export async function getPortalSettings() {
  const ctx = await requireRouteAccess("admin", "read");
  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenant.id },
    select: {
      slug: true,
      portalEnabled: true,
      bookingEnabled: true,
      autoConfirmBooking: true,
      bookingLeadHours: true,
      bookingMaxDays: true,
      bookingBufferMins: true,
      portalWelcomeMsg: true,
      portalLogoUrl: true,
      logoUrl: true,
    },
  });
  return tenant;
}

export async function updatePortalSettings(input: {
  portalEnabled: boolean;
  bookingEnabled: boolean;
  autoConfirmBooking: boolean;
  bookingLeadHours: number;
  bookingMaxDays: number;
  bookingBufferMins: number;
  portalWelcomeMsg?: string;
  portalLogoUrl?: string;
}) {
  const ctx = await requireRouteAccess("admin", "write");

  await db.tenant.update({
    where: { id: ctx.tenant.id },
    data: {
      portalEnabled: input.portalEnabled,
      bookingEnabled: input.bookingEnabled,
      autoConfirmBooking: input.autoConfirmBooking,
      bookingLeadHours: input.bookingLeadHours,
      bookingMaxDays: input.bookingMaxDays,
      bookingBufferMins: input.bookingBufferMins,
      portalWelcomeMsg: input.portalWelcomeMsg ?? null,
      portalLogoUrl: input.portalLogoUrl ?? null,
    },
  });

  revalidatePath("/admin/portal-settings");
  return { success: true };
}

export async function getPendingBookingCount() {
  const ctx = await requireRouteAccess("appointments", "read");
  return db.bookingRequest.count({
    where: { tenantId: ctx.tenant.id, status: "PENDING" },
  });
}
