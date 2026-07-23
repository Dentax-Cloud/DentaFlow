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
  const [expanded, setExpanded] = useState(false);
  const [showUpload, setShowUpload] = useState(false);

  const isChartTool = activeTool === "odontogram" || activeTool === "perio";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          setExpanded(false);
          setShowUpload(false);
        }
        onOpenChange(next);
      }}
    >
      <DialogContent
        className={
          expanded || isChartTool
            ? "max-h-[95vh] w-[min(96vw,72rem)] max-w-[96vw] overflow-y-auto"
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
            {" · stays in this encounter"}
          </DialogDescription>
        </DialogHeader>

        {activeTool === "odontogram" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Compact view" : "Expand full view"}
              </Button>
              <p className="text-xs text-slate-500">
                Chart stays in the spine workspace — no jump to classic clinical.
              </p>
            </div>
            <Odontogram
              data={chartData}
              notation="FDI"
              selectedTooth={focusTooth}
              disabled
              onToothClick={() => {}}
            />
          </div>
        )}

        {activeTool === "perio" && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Compact view" : "Expand full view"}
              </Button>
            </div>
            {perioMeasurements && perioMeasurements.length > 0 ? (
              <PerioChartGrid
                initialMeasurements={perioMeasurements}
                readOnly
              />
            ) : (
              <p className="text-sm text-slate-600">
                No periodontal measurements loaded for this visit yet. Capture
                charting from the Perio tool when measurements are available —
                this overlay stays inside the encounter.
              </p>
            )}
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
