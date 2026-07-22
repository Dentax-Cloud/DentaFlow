"use client";

import Link from "next/link";
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
  treatmentPlan?: { id: string; title: string } | null;
  perioMeasurements?: PerioMeasurement[];
}) {
  const activeTool = tool ?? "odontogram";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
            {patientId ? (
              <Link
                href={`/clinical?patientId=${encodeURIComponent(patientId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center text-sm font-medium text-teal-800 hover:underline"
              >
                Open full odontogram (new tab)
              </Link>
            ) : null}
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
            {patientId ? (
              <Link
                href={`/clinical/perio?patientId=${encodeURIComponent(patientId)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-10 items-center text-sm font-medium text-teal-800 hover:underline"
              >
                Open full perio chart (new tab)
              </Link>
            ) : null}
          </div>
        )}

        {activeTool === "radiographs" && (
          <ImageGallery
            images={toImageRecords(radiographs, "OPG")}
            canDelete={false}
          />
        )}

        {activeTool === "photos" && (
          <ImageGallery images={toImageRecords(photos, "PHOTO")} canDelete={false} />
        )}

        {activeTool === "treatment_plan" && (
          <div className="space-y-2 text-sm text-slate-700">
            {treatmentPlan ? (
              <>
                <p className="font-medium text-slate-900">{treatmentPlan.title}</p>
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
