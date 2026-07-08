"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ImageGallery, type ImageRecord } from "@/components/clinical/image-gallery";
import { ImageUploadForm } from "@/components/clinical/image-upload-form";
import { Button } from "@/components/ui/button";

type Props = {
  canWriteClinical?: boolean;
  patients: { id: string; firstName: string; lastName: string }[];
  selectedPatientId: string | null;
  openUpload?: boolean;
  images: ImageRecord[];
};

export default function RadiographPageClient({
  canWriteClinical = true,
  patients,
  selectedPatientId,
  openUpload = false,
  images,
}: Props) {
  const router = useRouter();
  const [showUpload, setShowUpload] = useState(openUpload);
  const [compareMode, setCompareMode] = useState(false);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);

  function handlePatientChange(patientId: string) {
    if (!patientId) router.push("/clinical/radiographs");
    else router.push(`/clinical/radiographs?patientId=${patientId}`);
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Radiograph Viewer</h1>
          <p className="text-sm text-muted-foreground">
            Upload, view, and annotate clinical images
          </p>
        </div>
        {selectedPatientId && canWriteClinical && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareMode(!compareMode)}
            >
              {compareMode ? "Exit compare" : "Compare"}
            </Button>
            <Button size="sm" onClick={() => setShowUpload(!showUpload)}>
              + Upload image
            </Button>
          </div>
        )}
        {selectedPatientId && !canWriteClinical && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCompareMode(!compareMode)}
          >
            {compareMode ? "Exit compare" : "Compare"}
          </Button>
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

      {showUpload && selectedPatientId && canWriteClinical && (
        <ImageUploadForm
          patientId={selectedPatientId}
          onUploaded={() => {
            setShowUpload(false);
            router.refresh();
          }}
          onCancel={() => setShowUpload(false)}
        />
      )}

      {selectedPatientId ? (
        <div>
          {selectedPatient && (
            <p className="mb-4 text-sm text-muted-foreground">
              Showing images for {selectedPatient.firstName} {selectedPatient.lastName}
              <span className="ml-2 text-xs">· {images.length} total</span>
            </p>
          )}
          <ImageGallery
            images={images}
            compareMode={compareMode}
            canDelete={canWriteClinical}
          />
        </div>
      ) : (
        <div className="py-16 text-center text-muted-foreground">
          <p className="mb-4 text-5xl">🦷</p>
          <p className="text-lg font-medium">Select a patient</p>
          <p className="mt-1 text-sm">Choose a patient above to view their radiographs</p>
        </div>
      )}
    </div>
  );
}
