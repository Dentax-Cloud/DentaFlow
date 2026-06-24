import type { PerioStagingResult } from "@/lib/clinical/perio-calc";

const STAGE_COLORS = {
  I: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-300",
  II: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300",
  III: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300",
  IV: "bg-red-100 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-300",
};

const GRADE_DESC = {
  A: "Slow progression",
  B: "Moderate progression",
  C: "Rapid progression",
};

const STAGE_LABELS = {
  I: "Initial",
  II: "Moderate",
  III: "Severe",
  IV: "Very severe",
};

export function PerioStagingCard({ staging }: { staging: PerioStagingResult }) {
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      <div className={`rounded-lg border p-3 ${STAGE_COLORS[staging.stage]}`}>
        <p className="text-xs font-medium opacity-70">Stage</p>
        <p className="text-2xl font-bold">{staging.stage}</p>
        <p className="mt-0.5 text-xs">{STAGE_LABELS[staging.stage]}</p>
      </div>

      <div className={`rounded-lg border p-3 ${STAGE_COLORS[staging.stage]}`}>
        <p className="text-xs font-medium opacity-70">Grade</p>
        <p className="text-2xl font-bold">{staging.grade}</p>
        <p className="mt-0.5 text-xs">{GRADE_DESC[staging.grade]}</p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300">
        <p className="text-xs font-medium opacity-70">BOP</p>
        <p className="text-2xl font-bold">{staging.bopPercent}%</p>
        <p className="mt-0.5 text-xs">Bleeding on probing</p>
      </div>

      <div className="rounded-lg border border-purple-200 bg-purple-50 p-3 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300">
        <p className="text-xs font-medium opacity-70">Max depth</p>
        <p className="text-2xl font-bold">{staging.maxPocketDepth}mm</p>
        <p className="mt-0.5 text-xs">{staging.sitesGt4} sites ≥4mm</p>
      </div>
    </div>
  );
}
