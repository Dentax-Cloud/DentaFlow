import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { isUploadthingConfigured } from "@/lib/uploadthing-env";
import { getPatientById } from "@/app/(dashboard)/features/patients/actions";
import { buildPatientFormFields } from "@/lib/countries/patient-form-config";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { mapPatientToFormValues } from "@/lib/tenant/sync-country-profile";
import { PatientDetailClient } from "./PatientDetailClient";
import { mapPatientTo360Profile } from "./map-patient-360";

export const runtime = "nodejs";

export default async function PatientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ edit?: string }>;
}) {
  const { id } = await params;
  const { edit } = await searchParams;
  const ctx = await requireRouteAccess("patients", "read");
  const role = ctx.staffMember?.role ?? UserRole.OWNER;
  const canWrite = hasPermission(role, PERMISSIONS.patients.write);
  const showUploadConfigHint =
    role === UserRole.OWNER ||
    role === UserRole.ADMIN ||
    hasPermission(role, PERMISSIONS.admin.write);

  const [patient, latestPerio, clinicalImageRows, photoRows, emergencyRows, formFields] =
    await Promise.all([
    getPatientById(ctx.tenant.id, id),
    db.perioChart.findFirst({
      where: { tenantId: ctx.tenant.id, patientId: id },
      orderBy: { chartDate: "desc" },
    }),
    db.clinicalImage.findMany({
      where: { tenantId: ctx.tenant.id, patientId: id, type: { not: "PHOTO" } },
      orderBy: { takenAt: "desc" },
      select: {
        id: true,
        url: true,
        type: true,
        fileName: true,
        takenAt: true,
      },
    }),
    db.clinicalImage.findMany({
      where: { tenantId: ctx.tenant.id, patientId: id, type: "PHOTO" },
      orderBy: { takenAt: "desc" },
      select: {
        id: true,
        url: true,
        photoCategory: true,
        isBeforePhoto: true,
        afterImageId: true,
        takenAt: true,
      },
    }),
    db.emergencyIntake.findMany({
      where: { tenantId: ctx.tenant.id, patientId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        chiefComplaint: true,
        painScore: true,
        triageLevel: true,
        status: true,
        createdAt: true,
      },
    }),
    canWrite
      ? buildPatientFormFields(ctx.tenant.id, ctx.tenant.countryCode ?? "AE")
      : Promise.resolve([]),
  ]);

  if (!patient) notFound();

  const byType: Record<string, number> = {};
  for (const img of clinicalImageRows) {
    byType[img.type] = (byType[img.type] ?? 0) + 1;
  }

  const byCategory: Record<string, number> = {};
  for (const img of photoRows) {
    const cat = img.photoCategory ?? "CUSTOM";
    byCategory[cat] = (byCategory[cat] ?? 0) + 1;
  }

  const beforeAfterCount = photoRows.filter(
    (img) => img.isBeforePhoto && img.afterImageId,
  ).length;

  return (
    <PatientDetailClient
      patient={mapPatientTo360Profile(patient)}
      clinicName={ctx.tenant.name}
      tenantCode={ctx.tenant.tenantCode ?? "—"}
      tenantSlug={ctx.tenant.slug}
      clinicPhone={ctx.tenant.phone}
      uploadsEnabled={isUploadthingConfigured()}
      showUploadConfigHint={showUploadConfigHint}
      latestPerio={
        latestPerio
          ? {
              id: latestPerio.id,
              chartDate: latestPerio.chartDate.toISOString(),
              perioStage: latestPerio.perioStage,
              perioGrade: latestPerio.perioGrade,
              bopPercent: latestPerio.bopPercent,
            }
          : null
      }
      clinicalImages={{
        total: clinicalImageRows.length,
        byType,
        recent: clinicalImageRows.slice(0, 4).map((img) => ({
          id: img.id,
          url: img.url,
          type: img.type,
          fileName: img.fileName,
          takenAt: img.takenAt?.toISOString() ?? null,
        })),
      }}
      patientPhotos={{
        total: photoRows.length,
        byCategory,
        beforeAfterCount,
        recent: photoRows.slice(0, 4).map((img) => ({
          id: img.id,
          url: img.url,
          photoCategory: img.photoCategory,
          takenAt: img.takenAt?.toISOString() ?? null,
        })),
      }}
      emergencyHistory={emergencyRows.map((e) => ({
        id: e.id,
        chiefComplaint: e.chiefComplaint,
        painScore: e.painScore,
        triageLevel: e.triageLevel,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      }))}
      canWrite={canWrite}
      countryCode={ctx.tenant.countryCode ?? "AE"}
      formFields={formFields}
      profileFormValues={mapPatientToFormValues(patient)}
      startInEditMode={edit === "profile" && canWrite}
    />
  );
}

