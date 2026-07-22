"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireTenantContext } from "@/lib/tenant/context";
import { requireStaffMemberRole } from "@/lib/rbac/staff-role";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import { createEncounterFromAppointment } from "@/lib/encounter/lifecycle";
import {
  createInsuranceVerificationAudited,
  updateInsuranceVerificationAudited,
} from "@/lib/encounter/repository";
import {
  resolveEncounterSpineSettings,
  staleAfterMinutesFromSettings,
} from "@/lib/encounter/tenant-settings";

const SPINE_DISABLED_MESSAGE =
  "Encounter spine is not enabled for this clinic. Contact your administrator.";

/**
 * Front-office insurance verification (Module 6).
 *
 * Accepts `insurance.write` (receptionist) OR `clinical_chart.write` (clinical staff).
 * Does NOT call assertRiskClearedForEncounter — that remains on the doctor spine path only.
 * Does NOT modify upsertSpineInsuranceVerification.
 */
async function requireFrontOfficeInsuranceWrite() {
  const ctx = await requireTenantContext();
  const role = requireStaffMemberRole(ctx);
  const allowed =
    hasPermission(role, PERMISSIONS.insurance.write) ||
    hasPermission(role, PERMISSIONS.clinical_chart.write);
  if (!allowed) {
    throw new Error("FORBIDDEN");
  }
  if (!isEncounterSpineEnabled(ctx.tenant)) {
    throw new Error(SPINE_DISABLED_MESSAGE);
  }
  return ctx;
}

export async function upsertFrontOfficeInsuranceVerification(input: {
  appointmentId: string;
  eligibilityStatus: string;
  preAuthStatus: string;
  estimatedCoverage?: number;
  estimatedCopay?: number;
  verifiedAt?: string | Date | null;
}) {
  const ctx = await requireFrontOfficeInsuranceWrite();

  const appointment = await db.appointment.findFirst({
    where: {
      id: input.appointmentId,
      tenantId: ctx.tenantId,
      deletedAt: null,
      isBlock: false,
    },
    select: { id: true, patientId: true },
  });
  if (!appointment) {
    throw new Error("Appointment not found");
  }

  const encounter = await createEncounterFromAppointment({
    tenantId: ctx.tenantId,
    appointmentId: appointment.id,
    userId: ctx.staffMember?.id,
    staffMemberId: ctx.staffMember?.id ?? null,
  });

  const [settingsRow, tenant] = await Promise.all([
    db.settings.findUnique({
      where: { tenantId: ctx.tenantId },
      select: { encounterSpineSettings: true },
    }),
    db.tenant.findFirst({
      where: { id: ctx.tenantId },
      select: { featureFlags: true },
    }),
  ]);
  const spineSettings = resolveEncounterSpineSettings({
    settingsJson: settingsRow?.encounterSpineSettings as Record<string, unknown> | null,
    featureFlags: tenant?.featureFlags as Record<string, unknown> | null,
  });
  const staleAfterMinutes = staleAfterMinutesFromSettings(spineSettings);

  const verifiedAt =
    input.verifiedAt === undefined || input.verifiedAt === null
      ? new Date()
      : input.verifiedAt instanceof Date
        ? input.verifiedAt
        : new Date(input.verifiedAt);

  const existing = await db.insuranceVerification.findFirst({
    where: { tenantId: ctx.tenantId, encounterId: encounter.id },
    orderBy: { createdAt: "desc" },
  });

  const coverage =
    input.estimatedCoverage != null ? new Prisma.Decimal(input.estimatedCoverage) : undefined;
  const copay =
    input.estimatedCopay != null ? new Prisma.Decimal(input.estimatedCopay) : undefined;

  let row;
  if (existing) {
    row = await updateInsuranceVerificationAudited(
      existing.id,
      ctx.tenantId,
      {
        eligibilityStatus: input.eligibilityStatus,
        preAuthStatus: input.preAuthStatus,
        ...(coverage != null ? { estimatedCoverage: coverage } : {}),
        ...(copay != null ? { estimatedCopay: copay } : {}),
        verifiedAt,
        staleAfterMinutes,
      },
      { userId: ctx.staffMember?.id },
    );
  } else {
    row = await createInsuranceVerificationAudited(
      {
        tenant: { connect: { id: ctx.tenantId } },
        encounter: { connect: { id: encounter.id } },
        eligibilityStatus: input.eligibilityStatus,
        preAuthStatus: input.preAuthStatus,
        estimatedCoverage: coverage ?? new Prisma.Decimal(0),
        estimatedCopay: copay ?? new Prisma.Decimal(0),
        verifiedAt,
        staleAfterMinutes,
      },
      { tenantId: ctx.tenantId, userId: ctx.staffMember?.id },
    );
  }

  revalidatePath("/reception");
  revalidatePath("/clinical");
  revalidatePath(`/clinical/encounter/${appointment.id}`);
  revalidatePath(`/clinical/encounter/${appointment.id}/spine`);

  return {
    encounterId: encounter.id,
    encounterStatus: encounter.status,
    verification: serializeDecimal(row as Record<string, unknown>),
  };
}
