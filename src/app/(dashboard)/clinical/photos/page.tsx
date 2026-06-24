export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { parseAnnotations, parseImageIds } from "@/lib/clinical/image-types";
import PhotoPageClient from "./photo-client";

export default async function PhotoPage({
  searchParams,
}: {
  searchParams: Promise<{ patientId?: string; tab?: string; appointmentId?: string }>;
}) {
  const { patientId, tab, appointmentId } = await searchParams;
  const ctx = await requireRouteAccess("clinical", "read");

  const patients = await db.patient.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null },
    select: { id: true, firstName: true, lastName: true },
    orderBy: { lastName: "asc" },
    take: 200,
  });

  const photos = patientId
    ? await db.clinicalImage.findMany({
        where: { tenantId: ctx.tenant.id, patientId, type: "PHOTO" },
        orderBy: { takenAt: "desc" },
      })
    : [];

  const presentations = patientId
    ? await db.casePresentation.findMany({
        where: { tenantId: ctx.tenant.id, patientId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  return (
    <PhotoPageClient
      patients={patients}
      selectedPatientId={patientId ?? null}
      appointmentId={appointmentId ?? null}
      photos={photos.map((p) => ({
        id: p.id,
        url: p.url,
        type: p.type,
        fileName: p.fileName,
        toothNumbers: p.toothNumbers,
        quadrant: p.quadrant,
        notes: p.notes,
        photoCategory: p.photoCategory,
        isBeforePhoto: p.isBeforePhoto,
        afterImageId: p.afterImageId,
        takenAt: p.takenAt?.toISOString() ?? null,
        annotations: parseAnnotations(p.annotations),
      }))}
      presentations={presentations.map((p) => ({
        id: p.id,
        title: p.title,
        description: p.description,
        imageIds: parseImageIds(p.imageIds),
        shareToken: p.shareToken,
        viewCount: p.viewCount,
        createdAt: p.createdAt.toISOString(),
      }))}
      defaultTab={tab ?? "gallery"}
    />
  );
}
