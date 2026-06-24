"use client";

import { useState, useCallback } from "react";
import { useCamera } from "@/lib/clinical/use-camera";
import {
  PHOTO_CATEGORY_CONFIG,
  STANDARD_PHOTO_SERIES,
  type PhotoCategory,
} from "@/lib/clinical/image-types";
import { Button } from "@/components/ui/button";
import { useUploadThing } from "@/lib/uploadthing-client";
import { saveClinicalImage } from "@/app/(dashboard)/features/clinical/image-actions";
import { toast } from "sonner";

type CapturedPhoto = {
  category: PhotoCategory;
  blob: Blob;
  preview: string;
  uploaded?: boolean;
  url?: string;
};

type Props = {
  patientId: string;
  appointmentId?: string;
  seriesMode?: boolean;
  onCapture?: (imageId: string, url: string) => void;
  onDone?: () => void;
};

export function CameraCapture({
  patientId,
  appointmentId,
  seriesMode = false,
  onCapture,
  onDone,
}: Props) {
  const {
    videoRef,
    isActive,
    isSupported,
    error,
    startCamera,
    stopCamera,
    flipCamera,
    capturePhoto,
  } = useCamera();

  const [category, setCategory] = useState<PhotoCategory>("CLOSEUP");
  const [captured, setCaptured] = useState<CapturedPhoto[]>([]);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [seriesIndex, setSeriesIndex] = useState(0);

  const { startUpload } = useUploadThing("clinicalImageUploader", {
    onUploadError: (e) => {
      toast.error(e.message);
    },
  });

  const currentCategory = seriesMode ? STANDARD_PHOTO_SERIES[seriesIndex] : category;

  const handleCapture = useCallback(async () => {
    setIsCapturing(true);
    try {
      const blob = await capturePhoto();
      if (!blob) return;

      const preview = URL.createObjectURL(blob);
      const newPhoto: CapturedPhoto = {
        category: currentCategory,
        blob,
        preview,
      };
      setCaptured((prev) => [...prev, newPhoto]);

      if (seriesMode && seriesIndex < STANDARD_PHOTO_SERIES.length - 1) {
        setSeriesIndex((prev) => prev + 1);
      }
    } finally {
      setIsCapturing(false);
    }
  }, [capturePhoto, currentCategory, seriesMode, seriesIndex]);

  async function handleUploadAll() {
    setIsUploading(true);
    try {
      const toUpload = captured.filter((p) => !p.uploaded);

      for (const photo of toUpload) {
        const file = new File([photo.blob], `photo-${photo.category}-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });

        const uploaded = await startUpload([file], { patientId });
        if (!uploaded?.[0]) continue;

        const image = await saveClinicalImage({
          patientId,
          url: uploaded[0].url,
          fileName: file.name,
          fileSize: file.size,
          mimeType: "image/jpeg",
          type: "PHOTO",
          subtype: photo.category,
          photoCategory: photo.category,
          appointmentId,
          takenAt: new Date().toISOString(),
        });

        onCapture?.(image.id, uploaded[0].url);

        setCaptured((prev) =>
          prev.map((p) =>
            p === photo ? { ...p, uploaded: true, url: uploaded[0].url } : p,
          ),
        );
      }

      toast.success(`Saved ${toUpload.length} photo(s)`);
      onDone?.();
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  }

  if (!isSupported) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        <p className="mb-3 text-4xl">📷</p>
        <p className="font-medium">Camera not supported</p>
        <p className="mt-1 text-sm">Use the upload option instead to add photos</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {seriesMode && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="font-medium">
              Photo {seriesIndex + 1} of {STANDARD_PHOTO_SERIES.length}
            </span>
            <span className="text-muted-foreground">{captured.length} captured</span>
          </div>
          <div className="flex gap-1">
            {STANDARD_PHOTO_SERIES.map((cat, i) => (
              <div
                key={cat}
                className={`h-1.5 flex-1 rounded-full transition-colors ${
                  i < captured.length
                    ? "bg-green-500"
                    : i === seriesIndex
                      ? "bg-blue-500"
                      : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="text-sm text-muted-foreground">
            {PHOTO_CATEGORY_CONFIG[currentCategory].icon}{" "}
            {PHOTO_CATEGORY_CONFIG[currentCategory].label} —{" "}
            {PHOTO_CATEGORY_CONFIG[currentCategory].description}
          </p>
        </div>
      )}

      {!seriesMode && (
        <div>
          <label className="text-xs font-medium">Photo type</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as PhotoCategory)}
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            {(Object.entries(PHOTO_CATEGORY_CONFIG) as [PhotoCategory, (typeof PHOTO_CATEGORY_CONFIG)[PhotoCategory]][]).map(
              ([key, cfg]) => (
                <option key={key} value={key}>
                  {cfg.icon} {cfg.label}
                </option>
              ),
            )}
          </select>
        </div>
      )}

      <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
        {isActive ? (
          <>
            <video ref={videoRef} className="h-full w-full object-cover" playsInline muted />
            <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-sm text-white">
              {PHOTO_CATEGORY_CONFIG[currentCategory].icon}{" "}
              {PHOTO_CATEGORY_CONFIG[currentCategory].label}
            </div>

            <div className="pointer-events-none absolute inset-0">
              <div className="grid h-full w-full grid-cols-3 grid-rows-3">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="border border-white/20" />
                ))}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-4 flex items-center justify-center gap-6">
              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={flipCamera}
                className="rounded-full border-white/30 bg-black/40 text-white hover:bg-black/60"
              >
                🔄
              </Button>

              <button
                type="button"
                onClick={handleCapture}
                disabled={isCapturing}
                className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white/50 bg-white shadow-lg transition-transform hover:scale-95 disabled:opacity-50"
              >
                <div className="h-12 w-12 rounded-full border-2 border-gray-300 bg-white" />
              </button>

              <Button
                variant="outline"
                size="icon"
                type="button"
                onClick={stopCamera}
                className="rounded-full border-white/30 bg-black/40 text-white hover:bg-black/60"
              >
                ✕
              </Button>
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            {error ? (
              <div className="p-4 text-center text-white">
                <p className="mb-2 text-red-400">⚠ {error}</p>
                <Button onClick={() => startCamera()} variant="outline" size="sm" type="button">
                  Try again
                </Button>
              </div>
            ) : (
              <Button
                onClick={() => startCamera()}
                size="lg"
                type="button"
                className="bg-white text-black hover:bg-gray-100"
              >
                📷 Open camera
              </Button>
            )}
          </div>
        )}
      </div>

      {captured.length > 0 && (
        <div className="space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-2">
            {captured.map((photo, i) => (
              <div key={i} className="relative flex-shrink-0">
                <img
                  src={photo.preview}
                  alt={photo.category}
                  className="h-20 w-20 rounded-lg border-2 border-gray-200 object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 rounded-b-lg bg-black/60 py-0.5 text-center text-[9px] text-white">
                  {PHOTO_CATEGORY_CONFIG[photo.category].label}
                </div>
                {photo.uploaded && (
                  <div className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-green-500 text-[10px] text-white">
                    ✓
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setCaptured((prev) => prev.filter((_, j) => j !== i))}
                  className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/60 text-[10px] text-white hover:bg-red-600"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Button
              onClick={handleUploadAll}
              disabled={isUploading || captured.every((p) => p.uploaded)}
              className="flex-1"
              type="button"
            >
              {isUploading
                ? "Uploading..."
                : `💾 Save ${captured.filter((p) => !p.uploaded).length} photos`}
            </Button>
            <Button
              variant="outline"
              onClick={() => setCaptured([])}
              disabled={isUploading}
              type="button"
            >
              Clear all
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
