"use client";

import { Odontogram } from "@/components/clinical/dental-chart";
import type { ToothChartData } from "@/lib/clinical/chart-types";
import type { SpineToolId } from "./spine-stage-nav";

type MediaThumb = {
  id: string;
  url: string;
  fileName: string | null;
  takenAt: string | null;
};

export function SpineClinicalFindings({
  chartData,
  perioSummary,
  radiographs,
  photos,
  onOpenTool,
}: {
  chartData: ToothChartData;
  perioSummary: {
    chartDate: string | null;
    worstPocket: number | null;
    bleedingSites: number | null;
  } | null;
  radiographs: MediaThumb[];
  photos: MediaThumb[];
  onOpenTool: (tool: SpineToolId, opts?: { tooth?: string }) => void;
}) {
  // Use ISO date slice only — avoid locale formatting (hydration-safe).
  const perioLine = perioSummary
    ? [
        perioSummary.chartDate
          ? `Charted ${perioSummary.chartDate.slice(0, 10)}`
          : "No chart date",
        perioSummary.worstPocket != null
          ? `Worst pocket ${perioSummary.worstPocket} mm`
          : null,
        perioSummary.bleedingSites != null
          ? `${perioSummary.bleedingSites} bleeding sites`
          : null,
      ]
        .filter(Boolean)
        .join(" · ")
    : "No perio chart on file";

  return (
    <section className="space-y-4">
      <h2 className="text-sm font-medium uppercase tracking-[0.12em] text-slate-500">
        Clinical findings
      </h2>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-800">Odontogram</h3>
          <button
            type="button"
            onClick={() => onOpenTool("odontogram")}
            className="min-h-10 rounded-md px-2 text-xs font-medium text-teal-800 hover:bg-teal-50"
          >
            Expand
          </button>
        </div>
        <div className="overflow-hidden rounded-lg [&_.rounded-xl]:rounded-lg [&_.rounded-xl]:p-2 [&_.rounded-xl]:sm:p-3">
          <Odontogram
            data={chartData}
            notation="FDI"
            onToothClick={(tooth) => onOpenTool("odontogram", { tooth })}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
        <div>
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Perio
          </h3>
          <p className="text-sm text-slate-800">{perioLine}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenTool("perio")}
          className="min-h-10 min-w-10 rounded-md px-3 text-xs font-medium text-teal-800 hover:bg-teal-50"
        >
          Open perio
        </button>
      </div>

      <MediaThumbGrid
        title="Radiographs"
        items={radiographs}
        empty="No radiographs"
        onOpen={() => onOpenTool("radiographs")}
      />
      <MediaThumbGrid
        title="Photos"
        items={photos}
        empty="No clinical photos"
        onOpen={() => onOpenTool("photos")}
      />
    </section>
  );
}

function MediaThumbGrid({
  title,
  items,
  empty,
  onOpen,
}: {
  title: string;
  items: MediaThumb[];
  empty: string;
  onOpen: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        <button
          type="button"
          onClick={onOpen}
          className="min-h-10 rounded-md px-2 text-xs font-medium text-teal-800 hover:bg-teal-50"
        >
          Open gallery
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {items.slice(0, 8).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={onOpen}
              className="group relative aspect-square min-h-10 overflow-hidden rounded-md border border-slate-200 bg-slate-100"
              title={item.fileName ?? title}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={item.fileName ?? title}
                className="h-full w-full object-cover transition group-hover:opacity-90"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
