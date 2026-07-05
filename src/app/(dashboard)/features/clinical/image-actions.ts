"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import type { Annotation } from "@/lib/clinical/image-types";

async function requirePatient(tenantId: string, patientId: string) {
  const patient = await db.patient.findFirst({
    where: tenantWhere(tenantId, { id: patientId, deletedAt: null }),
  });
  if (!patient) throw new Error("Patient not found");
  return patient;
}

export async function saveClinicalImage(input: {
  patientId: string;
  url: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  type: string;
  subtype?: string;
  toothNumbers?: string;
  quadrant?: string;
  notes?: string;
  takenAt?: string;
  appointmentId?: string;
  treatmentPlanId?: string;
  photoCategory?: string;
  photoSeriesId?: string;
  isBeforePhoto?: boolean;
}) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);
  await requirePatient(ctx.tenantId, input.patientId);

  const isBefore = input.photoCategory === "BEFORE" || input.isBeforePhoto === true;

  const image = await db.clinicalImage.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      uploadedById: ctx.staffMember?.id ?? null,
      url: input.url,
      fileName: input.fileName ?? null,
      fileSize: input.fileSize ?? null,
      mimeType: input.mimeType ?? null,
      type: input.type,
      subtype: input.subtype ?? null,
      toothNumbers: input.toothNumbers ?? null,
      quadrant: input.quadrant ?? null,
      notes: input.notes ?? null,
      takenAt: input.takenAt ? new Date(input.takenAt) : new Date(),
      appointmentId: input.appointmentId ?? null,
      treatmentPlanId: input.treatmentPlanId ?? null,
      photoCategory: input.photoCategory ?? null,
      photoSeriesId: input.photoSeriesId ?? null,
      isBeforePhoto: isBefore,
      annotations: [],
    },
  });

  if (input.photoCategory === "AFTER") {
    const before = await db.clinicalImage.findFirst({
      where: {
        tenantId: ctx.tenantId,
        patientId: input.patientId,
        isBeforePhoto: true,
        afterImageId: null,
      },
      orderBy: { takenAt: "desc" },
    });
    if (before) {
      await db.clinicalImage.update({
        where: { id: before.id },
        data: { afterImageId: image.id },
      });
    }
  }

  await db.auditLog
    .create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.staffMember?.id,
        performedById: ctx.staffMember?.id,
        action: "CREATE",
        entity: "ClinicalImage",
        entityId: image.id,
        metadata: {
          patientId: input.patientId,
          type: input.type,
          fileName: input.fileName,
          photoCategory: input.photoCategory,
        },
      },
    })
    .catch(() => null);

  revalidatePath("/clinical/radiographs");
  revalidatePath("/clinical/photos");
  revalidatePath(`/patients/${input.patientId}`);
  return image;
}

export async function getPatientImages(
  patientId: string,
  filters?: { type?: string; quadrant?: string },
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);
  await requirePatient(ctx.tenantId, patientId);

  return db.clinicalImage.findMany({
    where: {
      tenantId: ctx.tenantId,
      patientId,
      ...(filters?.type ? { type: filters.type } : {}),
      ...(filters?.quadrant ? { quadrant: filters.quadrant } : {}),
    },
    orderBy: { takenAt: "desc" },
  });
}

export async function getImage(imageId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);

  return db.clinicalImage.findFirst({
    where: { id: imageId, tenantId: ctx.tenantId },
  });
}

export async function saveAnnotations(imageId: string, annotations: Annotation[]) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  await db.clinicalImage.updateMany({
    where: { id: imageId, tenantId: ctx.tenantId },
    data: { annotations },
  });

  revalidatePath("/clinical/radiographs");
  revalidatePath("/clinical/photos");
}

export async function updateImageMeta(
  imageId: string,
  data: {
    notes?: string;
    toothNumbers?: string;
    quadrant?: string;
    type?: string;
    takenAt?: string;
  },
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  await db.clinicalImage.updateMany({
    where: { id: imageId, tenantId: ctx.tenantId },
    data: {
      ...data,
      takenAt: data.takenAt ? new Date(data.takenAt) : undefined,
    },
  });

  revalidatePath("/clinical/radiographs");
  revalidatePath("/clinical/photos");
}

export async function deleteClinicalImage(imageId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const image = await db.clinicalImage.findFirst({
    where: { id: imageId, tenantId: ctx.tenantId },
  });
  if (!image) throw new Error("Image not found");

  await db.clinicalImage.delete({ where: { id: imageId } });

  revalidatePath("/clinical/radiographs");
  revalidatePath("/clinical/photos");
  revalidatePath(`/patients/${image.patientId}`);
}

export async function linkImageToTreatmentPlan(imageId: string, treatmentPlanId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const plan = await db.treatmentPlan.findFirst({
    where: { id: treatmentPlanId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!plan) throw new Error("Treatment plan not found");

  await db.clinicalImage.updateMany({
    where: { id: imageId, tenantId: ctx.tenantId },
    data: { treatmentPlanId },
  });

  revalidatePath("/clinical/radiographs");
}
