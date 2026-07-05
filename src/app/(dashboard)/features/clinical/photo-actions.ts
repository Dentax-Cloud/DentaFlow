"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";

async function requirePatient(tenantId: string, patientId: string) {
  const patient = await db.patient.findFirst({
    where: tenantWhere(tenantId, { id: patientId, deletedAt: null }),
  });
  if (!patient) throw new Error("Patient not found");
  return patient;
}

export async function createPhotoSeries(input: {
  patientId: string;
  title: string;
  type?: string;
  notes?: string;
}) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);
  await requirePatient(ctx.tenantId, input.patientId);

  const series = await db.photoSeries.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      title: input.title,
      type: input.type ?? "STANDARD",
      notes: input.notes ?? null,
    },
  });

  revalidatePath("/clinical/photos");
  return series;
}

export async function getPatientPhotos(patientId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);
  await requirePatient(ctx.tenantId, patientId);

  return db.clinicalImage.findMany({
    where: {
      tenantId: ctx.tenantId,
      patientId,
      type: "PHOTO",
    },
    orderBy: { takenAt: "desc" },
  });
}

export async function linkBeforeAfter(beforeImageId: string, afterImageId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const [before, after] = await Promise.all([
    db.clinicalImage.findFirst({
      where: { id: beforeImageId, tenantId: ctx.tenantId },
    }),
    db.clinicalImage.findFirst({
      where: { id: afterImageId, tenantId: ctx.tenantId },
    }),
  ]);

  if (!before || !after) throw new Error("Images not found");
  if (before.patientId !== after.patientId) {
    throw new Error("Before and after images must belong to the same patient");
  }

  await db.clinicalImage.updateMany({
    where: { id: beforeImageId, tenantId: ctx.tenantId },
    data: { isBeforePhoto: true, afterImageId },
  });

  await db.clinicalImage.updateMany({
    where: { id: afterImageId, tenantId: ctx.tenantId },
    data: { isBeforePhoto: false },
  });

  revalidatePath("/clinical/photos");
}

export async function createCasePresentation(input: {
  patientId: string;
  title: string;
  description?: string;
  imageIds: string[];
}) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);
  await requirePatient(ctx.tenantId, input.patientId);

  const images = await db.clinicalImage.findMany({
    where: {
      id: { in: input.imageIds },
      tenantId: ctx.tenantId,
      patientId: input.patientId,
    },
  });

  if (images.length !== input.imageIds.length) {
    throw new Error("Some images not found or not authorized");
  }

  const presentation = await db.casePresentation.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      title: input.title,
      description: input.description ?? null,
      imageIds: JSON.stringify(input.imageIds),
    },
  });

  revalidatePath("/clinical/photos");
  return presentation;
}

export async function shareCasePresentation(presentationId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const presentation = await db.casePresentation.findFirst({
    where: { id: presentationId, tenantId: ctx.tenantId },
  });
  if (!presentation) throw new Error("Presentation not found");

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  await db.casePresentation.update({
    where: { id: presentationId },
    data: { shareToken: token, sharedAt: new Date(), expiresAt },
  });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const shareUrl = `${baseUrl}/case/${token}`;

  return { shareUrl, token, expiresAt };
}

export async function getPatientPresentations(patientId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);
  await requirePatient(ctx.tenantId, patientId);

  return db.casePresentation.findMany({
    where: { tenantId: ctx.tenantId, patientId },
    orderBy: { createdAt: "desc" },
  });
}

export async function deleteCasePresentation(presentationId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  await db.casePresentation.deleteMany({
    where: { id: presentationId, tenantId: ctx.tenantId },
  });

  revalidatePath("/clinical/photos");
}
