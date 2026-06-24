import { notFound } from "next/navigation";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { isUploadthingConfigured } from "@/lib/uploadthing-env";
import { getPatientById } from "@/app/(dashboard)/features/patients/actions";
import { PatientDetailClient } from "./PatientDetailClient";
import { mapPatientTo360Profile } from "./map-patient-360";

export const runtime = "nodejs";

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireRouteAccess("patients", "read");

  const [patient, latestPerio, clinicalImageRows, photoRows, emergencyRows] = await Promise.all([
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
      uploadsEnabled={isUploadthingConfigured()}
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
    />
  );
}

