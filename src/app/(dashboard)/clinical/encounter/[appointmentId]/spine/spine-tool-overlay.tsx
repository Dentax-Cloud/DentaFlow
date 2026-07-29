"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Odontogram } from "@/components/clinical/dental-chart";
import { PerioChartGrid } from "@/components/clinical/perio-chart-grid";
import { ImageGallery, type ImageRecord } from "@/components/clinical/image-gallery";
import { ImageUploadForm } from "@/components/clinical/image-upload-form";
import { Button } from "@/components/ui/button";
import type { ToothChartData } from "@/lib/clinical/chart-types";
import type { PerioMeasurement } from "@/lib/clinical/types";
import type { SpineToolId } from "./spine-stage-nav";

type MediaItem = {
  id: string;
  url: string;
  fileName: string | null;
  takenAt: string | null;
  type?: string;
};

function toImageRecords(
  items: MediaItem[],
  fallbackType: "OPG" | "PHOTO",
): ImageRecord[] {
  return items.map((item) => ({
    id: item.id,
    url: item.url,
    type: item.type ?? fallbackType,
    fileName: item.fileName,
    toothNumbers: null,
    quadrant: null,
    notes: null,
    takenAt: item.takenAt,
    annotations: [],
  }));
}

function spineReturnQuery(patientId: string, appointmentId?: string) {
  const params = new URLSearchParams({
    patientId,
    fromSpine: "1",
  });
  if (appointmentId) params.set("returnAppointmentId", appointmentId);
  return params.toString();
}

const TOOL_TITLES: Record<SpineToolId, string> = {
  odontogram: "Odontogram",
  perio: "Periodontal chart",
  radiographs: "Radiographs",
  photos: "Clinical photos",
  treatment_plan: "Treatment plan",
};

export function SpineToolOverlay({
  open,
  onOpenChange,
  tool,
  chartData,
  focusTooth,
  radiographs,
  photos,
  patientName,
  patientId,
  appointmentId,
  treatmentPlan,
  perioMeasurements,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tool: SpineToolId | null;
  chartData: ToothChartData;
  focusTooth?: string;
  radiographs: MediaItem[];
  photos: MediaItem[];
  patientName: string;
  patientId?: string;
  appointmentId?: string;
  treatmentPlan?: { id: string; title: string } | null;
  perioMeasurements?: PerioMeasurement[];
}) {
  const router = useRouter();
  const activeTool = tool ?? "odontogram";
  const [showUpload, setShowUpload] = useState(false);
  const returnQs =
    patientId != null ? spineReturnQuery(patientId, appointmentId) : null;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setShowUpload(false);
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={
          activeTool === "odontogram" || activeTool === "perio"
            ? "max-h-[90vh] max-w-4xl overflow-y-auto"
            : "max-h-[90vh] max-w-3xl overflow-y-auto"
        }
      >
        <DialogHeader>
          <DialogTitle>{TOOL_TITLES[activeTool]}</DialogTitle>
          <DialogDescription>
            {patientName}
            {focusTooth && activeTool === "odontogram"
              ? ` · Tooth ${focusTooth}`
              : ""}
          </DialogDescription>
        </DialogHeader>

        {activeTool === "odontogram" && (
          <div className="space-y-3">
            <Odontogram
              data={chartData}
              notation="FDI"
              selectedTooth={focusTooth}
              disabled
              onToothClick={() => {}}
            />
            {returnQs ? (
              <Link
                href={`/clinical?${returnQs}`}
                className="inline-flex min-h-10 items-center text-sm font-medium text-teal-800 hover:underline"
              >
                Expand full view
              </Link>
            ) : null}
            <p className="text-xs text-slate-500">
              Opens the classic odontogram with full charting. Use Back to
              encounter to return to this visit.
            </p>
          </div>
        )}

        {activeTool === "perio" && (
          <div className="space-y-3">
            {perioMeasurements && perioMeasurements.length > 0 ? (
              <PerioChartGrid
                initialMeasurements={perioMeasurements}
                readOnly
              />
            ) : (
              <p className="text-sm text-slate-600">
                Periodontal measurements are not loaded in this overlay. Open the
                full perio chart to review or update charting.
              </p>
            )}
            {returnQs ? (
              <Link
                href={`/clinical/perio?${returnQs}`}
                className="inline-flex min-h-10 items-center text-sm font-medium text-teal-800 hover:underline"
              >
                Expand full view
              </Link>
            ) : null}
            <p className="text-xs text-slate-500">
              Opens the classic perio chart. Use Back to encounter to return to
              this visit.
            </p>
          </div>
        )}

        {activeTool === "radiographs" && (
          <div className="space-y-3">
            {patientId ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowUpload((v) => !v)}
                >
                  {showUpload ? "Hide upload" : "Capture / upload radiograph"}
                </Button>
              </div>
            ) : null}
            {showUpload && patientId ? (
              <ImageUploadForm
                patientId={patientId}
                appointmentId={appointmentId}
                defaultType="OPG"
                onUploaded={() => {
                  setShowUpload(false);
                  router.refresh();
                }}
                onCancel={() => setShowUpload(false)}
              />
            ) : null}
            <ImageGallery
              images={toImageRecords(radiographs, "OPG")}
              canDelete={false}
            />
          </div>
        )}

        {activeTool === "photos" && (
          <div className="space-y-3">
            {patientId ? (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setShowUpload((v) => !v)}
                >
                  {showUpload ? "Hide upload" : "Capture / upload photo"}
                </Button>
              </div>
            ) : null}
            {showUpload && patientId ? (
              <ImageUploadForm
                patientId={patientId}
                appointmentId={appointmentId}
                defaultType="PHOTO"
                onUploaded={() => {
                  setShowUpload(false);
                  router.refresh();
                }}
                onCancel={() => setShowUpload(false)}
              />
            ) : null}
            <ImageGallery images={toImageRecords(photos, "PHOTO")} canDelete={false} />
          </div>
        )}

        {activeTool === "treatment_plan" && (
          <div className="space-y-2 text-sm text-slate-700">
            {treatmentPlan ? (
              <>
                <p className="font-medium text-slate-900">{treatmentPlan.title}</p>
                <p className="text-xs text-slate-500">
                  Plan details open in a new tab. Prefer Close & invoice on this
                  encounter for visit billing.
                </p>
                <Link
                  href={`/clinical/treatment-plans/${treatmentPlan.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-10 items-center font-medium text-teal-800 hover:underline"
                >
                  Open treatment plan (new tab)
                </Link>
              </>
            ) : (
              <p>No active plan</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
