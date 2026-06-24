"use client";

import { cn } from "@/lib/utils";
import type { ToothChartData } from "@/lib/clinical/chart-types";
import {
  CONDITION_COLORS,
  formatConditionType,
} from "@/lib/clinical/condition-config";
import {
  type ChartNotation,
  getArchTeeth,
  getDisplayNumber,
  toFdiNumber,
} from "@/lib/clinical/odontogram-notation";
import { ToothConditionType } from "@prisma/client";
import { ToothSvg } from "./tooth-svg";

export type { ToothChartData, ToothConditionEntry } from "@/lib/clinical/chart-types";

type OdontogramProps = {
  data: ToothChartData;
  notation: ChartNotation;
  selectedTooth?: string;
  onToothClick: (fdiNumber: string) => void;
  onNotationChange?: (notation: ChartNotation) => void;
  disabled?: boolean;
  highlightSurfaces?: string[];
};

function Arch({
  displayTeeth,
  fdiTeeth,
  data,
  notation,
  selectedTooth,
  onToothClick,
  disabled,
  highlightSurfaces,
}: {
  displayTeeth: string[];
  fdiTeeth: string[];
  data: ToothChartData;
  notation: ChartNotation;
  selectedTooth?: string;
  onToothClick: (fdi: string) => void;
  disabled?: boolean;
  highlightSurfaces?: string[];
}) {
  return (
    <div className="flex justify-center gap-1 flex-wrap px-2">
      {displayTeeth.map((displayNum, idx) => {
        const fdi = fdiTeeth[idx] ?? toFdiNumber(displayNum, notation);
        const entry = data[fdi];
        const conditions = entry?.conditions ?? [];
        return (
          <ToothSvg
            key={fdi}
            fdiNumber={fdi}
            displayNumber={displayNum}
            conditions={conditions}
            selected={selectedTooth === fdi}
            disabled={disabled}
            highlightSurfaces={
              selectedTooth === fdi
                ? (highlightSurfaces as import("@/lib/clinical/types").ToothSurface[])
                : undefined
            }
            onClick={() => onToothClick(fdi)}
          />
        );
      })}
    </div>
  );
}

const LEGEND_TYPES = [
  ToothConditionType.CARIES,
  ToothConditionType.RESTORATION,
  ToothConditionType.CROWN,
  ToothConditionType.MISSING,
  ToothConditionType.ROOT_CANAL,
  ToothConditionType.WATCH,
  ToothConditionType.IMPLANT,
  ToothConditionType.BRIDGE,
] as const;

export function Odontogram({
  data,
  notation,
  selectedTooth,
  onToothClick,
  onNotationChange,
  disabled,
  highlightSurfaces,
}: OdontogramProps) {
  const { upper: displayUpper, lower: displayLower } = getArchTeeth(notation);
  const fdiUpper = getArchTeeth("FDI").upper;
  const fdiLower = getArchTeeth("FDI").lower;

  return (
    <div className="rounded-xl border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-lg border p-0.5 w-fit">
          {(["FDI", "UNIVERSAL"] as const).map((n) => (
            <button
              key={n}
              type="button"
              disabled={disabled}
              onClick={() => onNotationChange?.(n)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                notation === n
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {n === "FDI" ? "FDI (ISO)" : "Universal (1–32)"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {LEGEND_TYPES.map((type) => (
            <div key={type} className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span
                className={cn(
                  "inline-block h-2.5 w-2.5 rounded-full border",
                  CONDITION_COLORS[type].split(" ")[0],
                  CONDITION_COLORS[type].split(" ")[1],
                )}
              />
              {formatConditionType(type)}
            </div>
          ))}
        </div>
      </div>

      <div className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Upper arch · {notation === "FDI" ? "18–28" : "1–16"}
      </div>
      <Arch
        displayTeeth={displayUpper}
        fdiTeeth={fdiUpper}
        data={data}
        notation={notation}
        selectedTooth={selectedTooth}
        onToothClick={onToothClick}
        disabled={disabled}
        highlightSurfaces={highlightSurfaces}
      />

      <div className="my-4 flex items-center gap-4">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] text-muted-foreground">Midline</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="mb-2 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Lower arch · {notation === "FDI" ? "48–38" : "17–32"}
      </div>
      <Arch
        displayTeeth={displayLower}
        fdiTeeth={fdiLower}
        data={data}
        notation={notation}
        selectedTooth={selectedTooth}
        onToothClick={onToothClick}
        disabled={disabled}
        highlightSurfaces={highlightSurfaces}
      />

      {selectedTooth && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Selected: tooth {getDisplayNumber(selectedTooth, notation)} (FDI {selectedTooth})
        </p>
      )}
    </div>
  );
}

/** @deprecated Use Odontogram */
export function DentalChart(
  props: Omit<OdontogramProps, "notation" | "onNotationChange"> & {
    notation?: ChartNotation;
  },
) {
  return (
    <Odontogram
      notation={props.notation ?? "FDI"}
      data={props.data}
      selectedTooth={props.selectedTooth}
      onToothClick={props.onToothClick}
      disabled={props.disabled}
    />
  );
}
