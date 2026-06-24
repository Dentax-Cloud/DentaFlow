"use client";

import { useState, useCallback } from "react";
import { getPocketDepthColor } from "@/lib/clinical/perio-calc";
import type { PerioMeasurement } from "@/lib/clinical/types";

const UPPER_TEETH = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
const LOWER_TEETH = [32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17];

function emptyMeasurement(toothNumber: number): PerioMeasurement {
  return {
    toothNumber,
    buccalDepths: [2, 2, 2],
    buccalBleeding: [false, false, false],
    buccalRecession: [0, 0, 0],
    lingualDepths: [2, 2, 2],
    lingualBleeding: [false, false, false],
    lingualRecession: [0, 0, 0],
    mobility: 0,
    furcation: 0,
  };
}

type ArrayField =
  | "buccalDepths"
  | "buccalBleeding"
  | "buccalRecession"
  | "lingualDepths"
  | "lingualBleeding"
  | "lingualRecession";

type Props = {
  initialMeasurements?: PerioMeasurement[];
  readOnly?: boolean;
  onChange?: (measurements: PerioMeasurement[]) => void;
  highlightTooth?: (toothNumber: number) => "improved" | "deteriorated" | "stable" | null;
};

export function PerioChartGrid({
  initialMeasurements,
  readOnly,
  onChange,
  highlightTooth,
}: Props) {
  const [measurements, setMeasurements] = useState<PerioMeasurement[]>(() => {
    const allTeeth = [...UPPER_TEETH, ...LOWER_TEETH];
    return allTeeth.map(
      (n) => initialMeasurements?.find((m) => m.toothNumber === n) ?? emptyMeasurement(n),
    );
  });

  const updateMeasurement = useCallback(
    (toothNumber: number, field: ArrayField, index: number, value: number | boolean) => {
      if (readOnly) return;
      setMeasurements((prev) => {
        const next = prev.map((m) => {
          if (m.toothNumber !== toothNumber) return m;
          const arr = [...m[field]] as (number | boolean)[];
          arr[index] = value;
          return { ...m, [field]: arr };
        });
        onChange?.(next);
        return next;
      });
    },
    [readOnly, onChange],
  );

  const updateSimple = useCallback(
    (toothNumber: number, field: "mobility" | "furcation", value: number) => {
      if (readOnly) return;
      setMeasurements((prev) => {
        const next = prev.map((m) =>
          m.toothNumber === toothNumber ? { ...m, [field]: value as 0 | 1 | 2 | 3 } : m,
        );
        onChange?.(next);
        return next;
      });
    },
    [readOnly, onChange],
  );

  function toothHighlightClass(toothNumber: number) {
    const h = highlightTooth?.(toothNumber);
    if (h === "improved") return "ring-2 ring-emerald-400 rounded-lg";
    if (h === "deteriorated") return "ring-2 ring-red-400 rounded-lg";
    return "";
  }

  function renderToothColumn(toothNumber: number) {
    const m = measurements.find((x) => x.toothNumber === toothNumber)!;

    return (
      <div
        key={toothNumber}
        className={`flex min-w-[52px] flex-col items-center p-0.5 ${toothHighlightClass(toothNumber)}`}
      >
        <div className="mb-1 text-center text-[10px] font-bold text-muted-foreground">
          {toothNumber}
        </div>

        <div className="mb-0.5 flex gap-0.5">
          {m.buccalBleeding.map((b, i) => (
            <button
              key={`bb-${i}`}
              type="button"
              disabled={readOnly}
              onClick={() => updateMeasurement(toothNumber, "buccalBleeding", i, !b)}
              className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-[8px] ${
                b ? "border-red-500 bg-red-500 text-white" : "border-gray-300"
              }`}
              title="Bleeding on probing"
            >
              {b ? "•" : ""}
            </button>
          ))}
        </div>

        <div className="mb-1 flex gap-0.5">
          {m.buccalDepths.map((d, i) => (
            <input
              key={`bd-${i}`}
              type="number"
              min={0}
              max={12}
              value={d}
              readOnly={readOnly}
              onChange={(e) =>
                updateMeasurement(
                  toothNumber,
                  "buccalDepths",
                  i,
                  parseInt(e.target.value, 10) || 0,
                )
              }
              style={{ borderColor: getPocketDepthColor(d), color: getPocketDepthColor(d) }}
              className="h-6 w-[14px] border-x-0 border-b-2 border-t-0 bg-transparent text-center text-[10px] font-bold outline-none"
            />
          ))}
        </div>

        <div className="my-0.5 flex h-8 w-10 items-center justify-center rounded border-2 border-gray-400 bg-white text-[9px] font-medium text-gray-500">
          {toothNumber}
        </div>

        <div className="mt-1 flex gap-0.5">
          {m.lingualDepths.map((d, i) => (
            <input
              key={`ld-${i}`}
              type="number"
              min={0}
              max={12}
              value={d}
              readOnly={readOnly}
              onChange={(e) =>
                updateMeasurement(
                  toothNumber,
                  "lingualDepths",
                  i,
                  parseInt(e.target.value, 10) || 0,
                )
              }
              style={{ borderColor: getPocketDepthColor(d), color: getPocketDepthColor(d) }}
              className="h-6 w-[14px] border-x-0 border-b-2 border-t-0 bg-transparent text-center text-[10px] font-bold outline-none"
            />
          ))}
        </div>

        <div className="mt-0.5 flex gap-0.5">
          {m.lingualBleeding.map((b, i) => (
            <button
              key={`lb-${i}`}
              type="button"
              disabled={readOnly}
              onClick={() => updateMeasurement(toothNumber, "lingualBleeding", i, !b)}
              className={`flex h-3.5 w-3.5 items-center justify-center rounded-sm border text-[8px] ${
                b ? "border-red-500 bg-red-500 text-white" : "border-gray-300"
              }`}
            >
              {b ? "•" : ""}
            </button>
          ))}
        </div>

        <select
          value={m.mobility}
          disabled={readOnly}
          onChange={(e) => updateSimple(toothNumber, "mobility", parseInt(e.target.value, 10))}
          className="mt-1 w-[46px] rounded border border-gray-200 text-center text-[9px]"
        >
          {[0, 1, 2, 3].map((v) => (
            <option key={v} value={v}>
              M{v}
            </option>
          ))}
        </select>

        <select
          value={m.furcation}
          disabled={readOnly}
          onChange={(e) => updateSimple(toothNumber, "furcation", parseInt(e.target.value, 10))}
          className="mt-0.5 w-[46px] rounded border border-gray-200 text-center text-[9px]"
        >
          {[0, 1, 2, 3].map((v) => (
            <option key={v} value={v}>
              F{v}
            </option>
          ))}
        </select>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <div className="mb-3 flex flex-wrap gap-4 text-[10px] text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-green-500" /> ≤3mm healthy
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-yellow-500" /> 4–5mm watch
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-500" /> ≥6mm pathological
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm bg-red-500" /> • = BOP
        </span>
      </div>

      <div className="mb-2">
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Upper arch
        </p>
        <div className="flex gap-1 rounded-lg border border-gray-100 bg-gray-50 p-2 dark:bg-muted/30">
          {UPPER_TEETH.map((n) => renderToothColumn(n))}
        </div>
      </div>

      <div>
        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Lower arch
        </p>
        <div className="flex gap-1 rounded-lg border border-gray-100 bg-gray-50 p-2 dark:bg-muted/30">
          {LOWER_TEETH.map((n) => renderToothColumn(n))}
        </div>
      </div>
    </div>
  );
}

export function getAllTeethMeasurements(
  measurements: PerioMeasurement[],
): PerioMeasurement[] {
  const allTeeth = [...UPPER_TEETH, ...LOWER_TEETH];
  return allTeeth.map(
    (n) => measurements.find((m) => m.toothNumber === n) ?? emptyMeasurement(n),
  );
}
