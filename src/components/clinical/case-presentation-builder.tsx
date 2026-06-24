"use client";

import { useState, useTransition } from "react";
import { createCasePresentation } from "@/app/(dashboard)/features/clinical/photo-actions";
import { PHOTO_CATEGORY_CONFIG, type PhotoCategory } from "@/lib/clinical/image-types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Image = {
  id: string;
  url: string;
  photoCategory: string | null;
  takenAt: string | null;
  notes: string | null;
};

type Props = {
  patientId: string;
  patientName: string;
  availableImages: Image[];
  onDone?: () => void;
};

export function CasePresentationBuilder({
  patientId,
  patientName,
  availableImages,
  onDone,
}: Props) {
  const [isPending, startTransition] = useTransition();
  const [title, setTitle] = useState(`Case Presentation — ${patientName}`);
  const [description, setDescription] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  function toggleImage(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function moveImage(id: string, direction: "up" | "down") {
    setSelectedIds((prev) => {
      const idx = prev.indexOf(id);
      if (idx === -1) return prev;
      const next = [...prev];
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= next.length) return prev;
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }

  function handleCreate() {
    if (!title || selectedIds.length === 0) return;
    startTransition(async () => {
      try {
        await createCasePresentation({
          patientId,
          title,
          description: description || undefined,
          imageIds: selectedIds,
        });
        toast.success("Presentation created");
        onDone?.();
      } catch {
        toast.error("Failed to create presentation");
      }
    });
  }

  const selectedImages = selectedIds
    .map((id) => availableImages.find((img) => img.id === id))
    .filter(Boolean) as Image[];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold">Build Case Presentation</h2>
        <p className="text-sm text-muted-foreground">
          Select photos and create a shareable presentation for {patientName}
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs font-medium">Presentation title *</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Description (optional)</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Treatment overview, goals, or notes for the patient..."
            className="mt-1 w-full resize-none rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-medium">
            Available photos
            <span className="ml-1 text-muted-foreground">({availableImages.length})</span>
          </h3>
          <div className="grid max-h-80 grid-cols-3 gap-2 overflow-y-auto">
            {availableImages.map((img) => {
              const isSelected = selectedIds.includes(img.id);
              const catConfig = img.photoCategory
                ? PHOTO_CATEGORY_CONFIG[img.photoCategory as PhotoCategory]
                : null;

              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => toggleImage(img.id)}
                  className={`relative aspect-square overflow-hidden rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-blue-500 ring-2 ring-blue-300"
                      : "border-transparent hover:border-gray-300"
                  }`}
                >
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  {isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-blue-500/20">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                        {selectedIds.indexOf(img.id) + 1}
                      </div>
                    </div>
                  )}
                  {catConfig && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 py-0.5 text-center text-[9px] text-white">
                      {catConfig.label}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {availableImages.length === 0 && (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No photos available. Upload photos first.
            </p>
          )}
        </div>

        <div>
          <h3 className="mb-3 text-sm font-medium">
            Presentation order
            <span className="ml-1 text-muted-foreground">({selectedIds.length} selected)</span>
          </h3>
          {selectedImages.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed p-8 text-center text-sm text-muted-foreground">
              Click photos on the left to add them
            </div>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto">
              {selectedImages.map((img, idx) => {
                const catConfig = img.photoCategory
                  ? PHOTO_CATEGORY_CONFIG[img.photoCategory as PhotoCategory]
                  : null;

                return (
                  <div key={img.id} className="flex items-center gap-2 rounded-lg border p-2">
                    <span className="w-4 text-xs font-bold text-muted-foreground">{idx + 1}</span>
                    <img src={img.url} alt="" className="h-10 w-10 rounded object-cover" />
                    <span className="flex-1 truncate text-xs">{catConfig?.label ?? "Photo"}</span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => moveImage(img.id, "up")}
                        disabled={idx === 0}
                        className="rounded p-1 text-xs hover:bg-muted disabled:opacity-30"
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        onClick={() => moveImage(img.id, "down")}
                        disabled={idx === selectedImages.length - 1}
                        className="rounded p-1 text-xs hover:bg-muted disabled:opacity-30"
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleImage(img.id)}
                        className="rounded p-1 text-xs text-red-400 hover:bg-muted hover:text-red-600"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onDone} type="button">
          Cancel
        </Button>
        <Button
          onClick={handleCreate}
          disabled={isPending || !title || selectedIds.length === 0}
          type="button"
        >
          {isPending ? "Creating..." : `Create presentation (${selectedIds.length} photos)`}
        </Button>
      </div>
    </div>
  );
}
