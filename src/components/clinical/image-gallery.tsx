"use client";

import { useState } from "react";
import {
  IMAGE_TYPE_CONFIG,
  parseAnnotations,
  type Annotation,
  type ImageType,
} from "@/lib/clinical/image-types";
import { ImageViewer } from "./image-viewer";
import { deleteClinicalImage } from "@/app/(dashboard)/features/clinical/image-actions";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export type ImageRecord = {
  id: string;
  url: string;
  type: string;
  fileName: string | null;
  toothNumbers: string | null;
  quadrant: string | null;
  notes: string | null;
  takenAt: string | null;
  annotations: Annotation[] | unknown;
};

type Props = {
  images: ImageRecord[];
  compareMode?: boolean;
};

export function ImageGallery({ images, compareMode }: Props) {
  const router = useRouter();
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<string>("ALL");

  const imageTypes = ["ALL", ...new Set(images.map((i) => i.type))];
  const filtered = filter === "ALL" ? images : images.filter((i) => i.type === filter);
  const viewing = viewingId ? images.find((i) => i.id === viewingId) : null;

  async function handleDelete(imageId: string) {
    if (!confirm("Delete this image? This cannot be undone.")) return;
    try {
      await deleteClinicalImage(imageId);
      toast.success("Image deleted");
      router.refresh();
    } catch {
      toast.error("Could not delete image");
    }
  }

  function toggleCompare(imageId: string) {
    setCompareIds((prev) => {
      if (prev.includes(imageId)) return prev.filter((id) => id !== imageId);
      if (prev.length < 2) return [...prev, imageId];
      return [prev[1], imageId];
    });
  }

  if (viewing && !compareMode) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="flex items-center gap-3 bg-zinc-900 p-3 text-white">
          <button type="button" onClick={() => setViewingId(null)} className="hover:text-gray-300">
            ← Back
          </button>
          <span className="text-sm font-medium">{viewing.fileName}</span>
          <span className="text-xs text-zinc-400">
            {IMAGE_TYPE_CONFIG[viewing.type as ImageType]?.label ?? viewing.type}
          </span>
          {viewing.toothNumbers && (
            <Badge variant="outline" className="border-zinc-600 text-zinc-300">
              Tooth {viewing.toothNumbers}
            </Badge>
          )}
        </div>
        <div className="flex-1">
          <ImageViewer
            imageId={viewing.id}
            url={viewing.url}
            initialAnnotations={parseAnnotations(viewing.annotations)}
            onClose={() => setViewingId(null)}
          />
        </div>
      </div>
    );
  }

  if (compareMode && compareIds.length === 2) {
    const img1 = images.find((i) => i.id === compareIds[0]);
    const img2 = images.find((i) => i.id === compareIds[1]);
    if (img1 && img2) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col bg-black">
          <div className="flex items-center justify-between bg-zinc-900 p-3 text-white">
            <button type="button" onClick={() => setCompareIds([])} className="hover:text-gray-300">
              ← Exit compare
            </button>
            <span className="text-sm text-zinc-400">Comparing 2 images</span>
          </div>
          <div className="grid flex-1 grid-cols-1 gap-px bg-zinc-800 md:grid-cols-2">
            <ImageViewer
              imageId={img1.id}
              url={img1.url}
              initialAnnotations={parseAnnotations(img1.annotations)}
              readOnly
            />
            <ImageViewer
              imageId={img2.id}
              url={img2.url}
              initialAnnotations={parseAnnotations(img2.annotations)}
              readOnly
            />
          </div>
        </div>
      );
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {imageTypes.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setFilter(t)}
            className={`rounded-full px-3 py-1 text-sm transition-colors ${
              filter === t ? "bg-blue-600 text-white" : "bg-muted hover:bg-muted/80"
            }`}
          >
            {t === "ALL" ? "All" : (IMAGE_TYPE_CONFIG[t as ImageType]?.label ?? t)}
            <span className="ml-1 text-xs opacity-70">
              ({t === "ALL" ? images.length : images.filter((i) => i.type === t).length})
            </span>
          </button>
        ))}
      </div>

      {compareMode && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Select 2 images to compare side-by-side
          {compareIds.length > 0 && (
            <span className="ml-2 font-medium">({compareIds.length}/2 selected)</span>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="mb-3 text-4xl">📷</p>
          <p className="font-medium">No images yet</p>
          <p className="mt-1 text-sm">Upload radiographs or clinical photos</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((img) => {
            const isSelected = compareIds.includes(img.id);
            const typeConfig = IMAGE_TYPE_CONFIG[img.type as ImageType];
            const annCount = parseAnnotations(img.annotations).length;

            return (
              <div
                key={img.id}
                role="button"
                tabIndex={0}
                className={`group relative cursor-pointer overflow-hidden rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-300"
                    : "border-transparent hover:border-gray-300"
                }`}
                onClick={() => {
                  if (compareMode) toggleCompare(img.id);
                  else setViewingId(img.id);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    if (compareMode) toggleCompare(img.id);
                    else setViewingId(img.id);
                  }
                }}
              >
                <div className="aspect-square bg-black">
                  <img
                    src={img.url}
                    alt={img.fileName ?? "Clinical image"}
                    className="h-full w-full object-contain"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect fill='%23333'/><text x='50%' y='50%' fill='%23666' text-anchor='middle' dy='.3em' font-size='10'>No preview</text></svg>";
                    }}
                  />
                </div>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                  <p className="text-xs font-medium text-white">
                    {typeConfig?.icon} {typeConfig?.label ?? img.type}
                  </p>
                  {img.takenAt && (
                    <p className="text-xs text-zinc-400">
                      {new Date(img.takenAt).toLocaleDateString()}
                    </p>
                  )}
                  {img.toothNumbers && (
                    <p className="text-xs text-zinc-400">Tooth {img.toothNumbers}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    void handleDelete(img.id);
                  }}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-xs text-white opacity-0 transition-opacity hover:bg-red-600 group-hover:opacity-100"
                >
                  ✕
                </button>
                {annCount > 0 && (
                  <div className="absolute left-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs text-white">
                    {annCount}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
