"use client";

import { cn } from "@/lib/utils";
import type { ToothChartData } from "@/lib/clinical/chart-types";
import {
  CONDITION_COLORS,
  CONDITION_DOT_COLORS,
  formatConditionType,
  getPrimaryConditionType,
} from "@/lib/clinical/condition-config";
import {
  type ChartNotation,
  getArchTeeth,
  getDisplayNumber,
  toFdiNumber,
} from "@/lib/clinical/odontogram-notation";
import { ToothConditionType } from "@prisma/client";

export type { ToothChartData, ToothConditionEntry } from "@/lib/clinical/chart-types";

type OdontogramProps = {
  data: ToothChartData;
  notation: ChartNotation;
  selectedTooth?: string;
  onToothClick: (fdiNumber: string) => void;
  onNotationChange?: (notation: ChartNotation) => void;
  disabled?: boolean;
};

function ToothSvg({
  fdiNumber,
  displayNumber,
  conditions,
  selected,
  onClick,
  disabled,
}: {
  fdiNumber: string;
  displayNumber: string;
  conditions: ToothConditionType[];
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  const primary = getPrimaryConditionType(conditions);
  const colorClass = primary
    ? CONDITION_COLORS[primary]
    : "fill-white stroke-gray-300 dark:fill-slate-800 dark:stroke-slate-600";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`Tooth ${displayNumber}${conditions.length ? `, ${conditions.length} finding(s)` : ""}`}
      aria-pressed={selected}
      className={cn(
        "group flex flex-col items-center gap-0.5 transition-transform",
        !disabled && "hover:scale-110",
        selected && "scale-110",
        disabled && "opacity-60 cursor-not-allowed",
      )}
    >
      <svg
        width="32"
        height="40"
        viewBox="0 0 28 36"
        className={cn(colorClass, selected && "drop-shadow-md ring-2 ring-primary/40 rounded-sm")}
      >
        <path
          d="M14 2 C8 2 4 8 4 14 C4 22 6 30 8 34 L20 34 C22 30 24 22 24 14 C24 8 20 2 14 2 Z"
          className={colorClass}
          strokeWidth="1.5"
        />
      </svg>
      <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground">
        {displayNumber}
      </span>
      {conditions.length > 0 && (
        <div className="flex max-w-[36px] flex-wrap justify-center gap-0.5">
          {conditions.slice(0, 4).map((type, i) => (
            <span
              key={`${fdiNumber}-${type}-${i}`}
              className={cn("h-1.5 w-1.5 rounded-full", CONDITION_DOT_COLORS[type])}
              title={formatConditionType(type)}
            />
          ))}
          {conditions.length > 4 && (
            <span className="text-[8px] text-muted-foreground">+{conditions.length - 4}</span>
          )}
        </div>
      )}
    </button>
  );
}

function Arch({
  displayTeeth,
  fdiTeeth,
  data,
  notation,
  selectedTooth,
  onToothClick,
  disabled,
}: {
  displayTeeth: string[];
  fdiTeeth: string[];
  data: ToothChartData;
  notation: ChartNotation;
  selectedTooth?: string;
  onToothClick: (fdi: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex justify-center gap-0.5 flex-wrap">
      {displayTeeth.map((displayNum, idx) => {
        const fdi = fdiTeeth[idx] ?? toFdiNumber(displayNum, notation);
        const entry = data[fdi];
        const types = entry?.conditions.map((c) => c.type) ?? [];
        return (
          <ToothSvg
            key={fdi}
            fdiNumber={fdi}
            displayNumber={displayNum}
            conditions={types}
            selected={selectedTooth === fdi}
            disabled={disabled}
            onClick={() => onToothClick(fdi)}
          />
        );
      })}
    </div>
  );
}

export function Odontogram({
  data,
  notation,
  selectedTooth,
  onToothClick,
  onNotationChange,
  disabled,
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
              {n === "FDI" ? "FDI" : "Universal"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {(
            [
              ToothConditionType.CARIES,
              ToothConditionType.RESTORATION,
              ToothConditionType.CROWN,
              ToothConditionType.MISSING,
              ToothConditionType.IMPLANT,
            ] as const
          ).map((type) => (
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

      <div className="space-y-6">
        <Arch
          displayTeeth={displayUpper}
          fdiTeeth={fdiUpper}
          data={data}
          notation={notation}
          selectedTooth={selectedTooth}
          onToothClick={onToothClick}
          disabled={disabled}
        />
        <div className="mx-auto h-px w-3/4 bg-border" />
        <Arch
          displayTeeth={displayLower}
          fdiTeeth={fdiLower}
          data={data}
          notation={notation}
          selectedTooth={selectedTooth}
          onToothClick={onToothClick}
          disabled={disabled}
        />
      </div>

      {selectedTooth && (
        <p className="mt-4 text-center text-xs text-muted-foreground">
          Selected: tooth {getDisplayNumber(selectedTooth, notation)} (FDI {selectedTooth})
        </p>
      )}
    </div>
  );
}

/** @deprecated Use Odontogram — kept for gradual migration */
export function DentalChart(props: Omit<OdontogramProps, "notation" | "onNotationChange"> & {
  notation?: ChartNotation;
}) {
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
