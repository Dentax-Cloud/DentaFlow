export const runtime = "nodejs";

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { PHOTO_CATEGORY_CONFIG, parseImageIds, type PhotoCategory } from "@/lib/clinical/image-types";

export default async function PublicCasePresentationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const presentation = await db.casePresentation.findUnique({
    where: { shareToken: token },
    include: {
      patient: { select: { firstName: true, lastName: true } },
      tenant: { select: { name: true, phone: true, email: true } },
    },
  });

  if (!presentation || !presentation.shareToken) notFound();
  if (presentation.expiresAt && presentation.expiresAt < new Date()) notFound();

  await db.casePresentation
    .update({
      where: { id: presentation.id },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => null);

  const imageIds = parseImageIds(presentation.imageIds);
  const images = await db.clinicalImage.findMany({
    where: {
      id: { in: imageIds },
      tenantId: presentation.tenantId,
      patientId: presentation.patientId,
    },
    select: {
      id: true,
      url: true,
      photoCategory: true,
      notes: true,
      takenAt: true,
    },
  });

  const sortedImages = imageIds
    .map((id) => images.find((img) => img.id === id))
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{presentation.tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[presentation.tenant.phone, presentation.tenant.email].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="mb-6 rounded-xl border bg-white p-6">
          <h2 className="text-xl font-bold">{presentation.title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Patient: {presentation.patient.firstName} {presentation.patient.lastName}
          </p>
          {presentation.description && (
            <p className="mt-3 text-sm text-gray-600">{presentation.description}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {sortedImages.map(
            (img, idx) =>
              img && (
                <div key={img.id} className="overflow-hidden rounded-xl border bg-white">
                  <img
                    src={img.url}
                    alt={img.photoCategory ?? `Photo ${idx + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  {(img.photoCategory || img.notes) && (
                    <div className="p-2">
                      {img.photoCategory && (
                        <p className="text-xs font-medium text-gray-700">
                          {PHOTO_CATEGORY_CONFIG[img.photoCategory as PhotoCategory]?.label ??
                            img.photoCategory.replace(/_/g, " ")}
                        </p>
                      )}
                      {img.notes && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{img.notes}</p>
                      )}
                    </div>
                  )}
                </div>
              ),
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Prepared by {presentation.tenant.name}
          {presentation.expiresAt && (
            <> · Link expires {presentation.expiresAt.toLocaleDateString()}</>
          )}
        </p>
      </div>
    </div>
  );
}
