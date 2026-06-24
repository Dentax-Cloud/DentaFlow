"use client";

import { useState } from "react";
import { useUploadThing } from "@/lib/uploadthing-client";
import { saveClinicalImage } from "@/app/(dashboard)/features/clinical/image-actions";
import { IMAGE_TYPE_CONFIG, type ImageType } from "@/lib/clinical/image-types";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

type Props = {
  patientId: string;
  appointmentId?: string;
  onUploaded: () => void;
  onCancel: () => void;
};

export function ImageUploadForm({ patientId, appointmentId, onUploaded, onCancel }: Props) {
  const [type, setType] = useState<ImageType>("OPG");
  const [toothNumbers, setToothNumbers] = useState("");
  const [quadrant, setQuadrant] = useState("");
  const [notes, setNotes] = useState("");
  const [takenAt, setTakenAt] = useState(new Date().toISOString().split("T")[0]);
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { startUpload, isUploading: utUploading } = useUploadThing("clinicalImageUploader", {
    onUploadProgress: (p) => setProgress(p),
    onUploadError: (e) => {
      toast.error(e.message);
    },
  });

  async function handleUpload() {
    if (!files.length) return;
    setIsUploading(true);

    try {
      const uploaded = await startUpload(files, { patientId });
      if (!uploaded?.length) {
        toast.error("Upload failed");
        return;
      }

      for (const file of uploaded) {
        await saveClinicalImage({
          patientId,
          url: file.url,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type ?? undefined,
          type,
          toothNumbers: toothNumbers || undefined,
          quadrant: quadrant || undefined,
          notes: notes || undefined,
          takenAt,
          appointmentId,
        });
      }

      toast.success(`Uploaded ${uploaded.length} image(s)`);
      onUploaded();
    } catch {
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }

  const config = IMAGE_TYPE_CONFIG[type];
  const busy = isUploading || utUploading;

  return (
    <div className="space-y-4 rounded-xl border bg-muted/30 p-4">
      <h3 className="font-medium">Upload radiograph / image</h3>

      <div>
        <label className="text-xs font-medium">Image type</label>
        <div className="mt-1 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.entries(IMAGE_TYPE_CONFIG) as [ImageType, (typeof IMAGE_TYPE_CONFIG)[ImageType]][]).map(
            ([key, cfg]) => (
              <button
                key={key}
                type="button"
                onClick={() => setType(key)}
                className={`rounded-lg border p-2 text-center text-xs transition-all ${
                  type === key
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <span className="block text-lg">{cfg.icon}</span>
                {cfg.label}
              </button>
            ),
          )}
        </div>
      </div>

      <div>
        <label className="text-xs font-medium">Select files</label>
        <input
          type="file"
          multiple
          accept={config.acceptedFormats.join(",")}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="mt-1 w-full text-sm"
        />
        {files.length > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">{files.length} file(s) selected</p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium">Date taken</label>
          <input
            type="date"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Quadrant</label>
          <select
            value={quadrant}
            onChange={(e) => setQuadrant(e.target.value)}
            className="mt-1 w-full rounded-md border bg-white px-3 py-2 text-sm"
          >
            <option value="">All / Full mouth</option>
            <option value="UL">Upper Left</option>
            <option value="UR">Upper Right</option>
            <option value="LL">Lower Left</option>
            <option value="LR">Lower Right</option>
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Tooth numbers</label>
          <input
            value={toothNumbers}
            onChange={(e) => setToothNumbers(e.target.value)}
            placeholder="e.g. 16, 17"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium">Notes</label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Pre-op periapical"
            className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
          />
        </div>
      </div>

      {busy && (
        <div className="h-2 w-full rounded-full bg-gray-200">
          <div
            className="h-2 rounded-full bg-blue-500 transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={handleUpload} disabled={busy || !files.length}>
          {busy ? `Uploading ${progress}%...` : "Upload"}
        </Button>
      </div>
    </div>
  );
}
