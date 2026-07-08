"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CameraCapture } from "@/components/clinical/camera-capture";
import { ImageUploadForm } from "@/components/clinical/image-upload-form";
import { ImageGallery, type ImageRecord } from "@/components/clinical/image-gallery";
import { BeforeAfterSlider } from "@/components/clinical/before-after-slider";
import { CasePresentationBuilder } from "@/components/clinical/case-presentation-builder";
import {
  shareCasePresentation,
  deleteCasePresentation,
} from "@/app/(dashboard)/features/clinical/photo-actions";
import { toast } from "sonner";

type PhotoRecord = ImageRecord & {
  photoCategory: string | null;
  isBeforePhoto: boolean;
  afterImageId: string | null;
};

type Presentation = {
  id: string;
  title: string;
  description: string | null;
  imageIds: string[];
  shareToken: string | null;
  viewCount: number;
  createdAt: string;
};

type Props = {
  canWriteClinical?: boolean;
  patients: { id: string; firstName: string; lastName: string }[];
  selectedPatientId: string | null;
  appointmentId: string | null;
  photos: PhotoRecord[];
  presentations: Presentation[];
  defaultTab: string;
};

export default function PhotoPageClient({
  canWriteClinical = true,
  patients,
  selectedPatientId,
  appointmentId,
  photos,
  presentations,
  defaultTab,
}: Props) {
  const router = useRouter();
  const [showCamera, setShowCamera] = useState(false);
  const [seriesMode, setSeriesMode] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [showPresBuilder, setShowPresBuilder] = useState(false);
  const [shareUrls, setShareUrls] = useState<Record<string, string>>({});

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  const beforePhotos = photos.filter((p) => p.isBeforePhoto && p.afterImageId);
  const beforeAfterPairs = beforePhotos
    .map((before) => {
      const after = photos.find((p) => p.id === before.afterImageId);
      return after ? { before, after } : null;
    })
    .filter(Boolean) as { before: PhotoRecord; after: PhotoRecord }[];

  function handlePatientChange(patientId: string) {
    if (!patientId) router.push("/clinical/photos");
    else router.push(`/clinical/photos?patientId=${patientId}`);
  }

  async function handleShare(presentationId: string) {
    try {
      const result = await shareCasePresentation(presentationId);
      setShareUrls((prev) => ({ ...prev, [presentationId]: result.shareUrl }));
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(result.shareUrl).catch(() => null);
      }
      toast.success("Share link copied");
    } catch {
      toast.error("Failed to share presentation");
    }
  }

  async function handleDeletePresentation(id: string) {
    if (!confirm("Delete this presentation?")) return;
    await deleteCasePresentation(id);
    router.refresh();
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clinical Photography</h1>
          <p className="text-sm text-muted-foreground">
            Capture, organize and present clinical photos
          </p>
        </div>
        {selectedPatientId && canWriteClinical && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setShowCamera(!showCamera);
                setShowUpload(false);
              }}
            >
              📷 Camera
            </Button>
            <Button
              variant="outline"
              size="sm"
              type="button"
              onClick={() => {
                setShowUpload(!showUpload);
                setShowCamera(false);
              }}
            >
              ⬆ Upload
            </Button>
            <Button
              size="sm"
              type="button"
              onClick={() => setShowPresBuilder(true)}
              disabled={photos.length === 0}
            >
              🎞 Build presentation
            </Button>
          </div>
        )}
      </div>

      <div>
        <label className="text-sm font-medium">Select patient</label>
        <select
          value={selectedPatientId ?? ""}
          onChange={(e) => handlePatientChange(e.target.value)}
          className="mt-1 w-full max-w-sm rounded-md border bg-white px-3 py-2 text-sm"
        >
          <option value="">— Choose a patient —</option>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.lastName}, {p.firstName}
            </option>
          ))}
        </select>
      </div>

      {!selectedPatientId ? (
        <div className="py-16 text-center text-muted-foreground">
          <p className="mb-4 text-5xl">📸</p>
          <p className="text-lg font-medium">Select a patient to start</p>
        </div>
      ) : (
        <>
          {canWriteClinical && showCamera && (
            <Card className="p-4">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-medium">Camera capture</h3>
                <div className="flex gap-2">
                  <Button
                    variant={seriesMode ? "default" : "outline"}
                    size="sm"
                    type="button"
                    onClick={() => setSeriesMode(!seriesMode)}
                  >
                    {seriesMode ? "Series mode on" : "Standard series (9 photos)"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={() => setShowCamera(false)}
                  >
                    Close
                  </Button>
                </div>
              </div>
              <CameraCapture
                patientId={selectedPatientId}
                appointmentId={appointmentId ?? undefined}
                seriesMode={seriesMode}
                onDone={() => {
                  setShowCamera(false);
                  router.refresh();
                }}
              />
            </Card>
          )}

          {canWriteClinical && showUpload && (
            <ImageUploadForm
              patientId={selectedPatientId}
              appointmentId={appointmentId ?? undefined}
              defaultType="PHOTO"
              onUploaded={() => {
                setShowUpload(false);
                router.refresh();
              }}
              onCancel={() => setShowUpload(false)}
            />
          )}

          {canWriteClinical && showPresBuilder && (
            <Card className="p-4">
              <CasePresentationBuilder
                patientId={selectedPatientId}
                patientName={`${selectedPatient?.firstName} ${selectedPatient?.lastName}`}
                availableImages={photos}
                onDone={() => {
                  setShowPresBuilder(false);
                  router.refresh();
                }}
              />
            </Card>
          )}

          <Tabs defaultValue={defaultTab}>
            <TabsList>
              <TabsTrigger value="gallery">Gallery ({photos.length})</TabsTrigger>
              <TabsTrigger value="before-after">
                Before/After ({beforeAfterPairs.length})
              </TabsTrigger>
              <TabsTrigger value="presentations">
                Presentations ({presentations.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="gallery">
              <ImageGallery images={photos} canDelete={canWriteClinical} />
            </TabsContent>

            <TabsContent value="before-after">
              {beforeAfterPairs.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="mb-3 text-4xl">↔</p>
                  <p className="font-medium">No before/after pairs yet</p>
                  <p className="mt-1 text-sm">
                    Capture photos tagged as Before and After to compare them
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {beforeAfterPairs.map((pair) => (
                    <div key={pair.before.id}>
                      <BeforeAfterSlider
                        beforeUrl={pair.before.url}
                        afterUrl={pair.after.url}
                      />
                      <p className="mt-2 text-center text-xs text-muted-foreground">
                        Drag slider to compare
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="presentations">
              {presentations.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <p className="mb-3 text-4xl">🎞</p>
                  <p className="font-medium">No presentations yet</p>
                  <p className="mt-1 text-sm">
                    Build a case presentation from the photos above
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {presentations.map((pres) => (
                    <Card key={pres.id} className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <h3 className="font-medium">{pres.title}</h3>
                          {pres.description && (
                            <p className="mt-0.5 text-sm text-muted-foreground">
                              {pres.description}
                            </p>
                          )}
                          <p className="mt-1 text-xs text-muted-foreground">
                            {pres.imageIds.length} photos · Created{" "}
                            {new Date(pres.createdAt).toLocaleDateString()}
                            {pres.viewCount > 0 && ` · ${pres.viewCount} views`}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          {canWriteClinical ? (
                          <>
                          <Button
                            size="sm"
                            variant="outline"
                            type="button"
                            onClick={() => handleShare(pres.id)}
                          >
                            🔗 Share
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => handleDeletePresentation(pres.id)}
                            className="text-red-400 hover:text-red-600"
                          >
                            Delete
                          </Button>
                          </>
                          ) : null}
                        </div>
                      </div>

                      {shareUrls[pres.id] && (
                        <div className="mt-3 break-all rounded border border-green-200 bg-green-50 p-2 font-mono text-xs text-green-800">
                          ✓ Copied: {shareUrls[pres.id]}
                        </div>
                      )}

                      <div className="mt-3 flex gap-1 overflow-x-auto">
                        {pres.imageIds.slice(0, 6).map((imgId) => {
                          const img = photos.find((p) => p.id === imgId);
                          return img ? (
                            <img
                              key={imgId}
                              src={img.url}
                              alt=""
                              className="h-12 w-12 flex-shrink-0 rounded object-cover"
                            />
                          ) : null;
                        })}
                        {pres.imageIds.length > 6 && (
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                            +{pres.imageIds.length - 6}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
