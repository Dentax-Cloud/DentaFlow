"use client";

import { cn } from "@/lib/utils";
import type { ToothConditionType } from "@prisma/client";
import type { ToothSurface } from "@/lib/clinical/types";
import { CHART_SURFACES } from "@/lib/clinical/types";
import {
  CONDITION_COLORS,
  CONDITION_DOT_COLORS,
  formatConditionType,
  getPrimaryConditionType,
} from "@/lib/clinical/condition-config";
import {
  deriveToothStatus,
  getSurfaceFindings,
  surfaceFillClass,
  surfaceStrokeClass,
} from "@/lib/clinical/surface-utils";
import { Crown, Link2, X } from "lucide-react";

const SURFACE_PATHS: Record<ToothSurface, string> = {
  M: "M4 14 L14 4 L14 18 Z",
  D: "M24 14 L14 4 L14 18 Z",
  O: "M8 8 L20 8 L20 16 L8 16 Z",
  B: "M6 6 L22 6 L18 12 L10 12 Z",
  L: "M6 24 L22 24 L18 18 L10 18 Z",
  I: "M8 8 L20 8 L20 16 L8 16 Z",
  V: "M6 6 L22 6 L18 12 L10 12 Z",
};

function StatusOverlay({ status }: { status: ReturnType<typeof deriveToothStatus> }) {
  if (status === "MISSING") {
    return (
      <g className="pointer-events-none">
        <line x1="6" y1="6" x2="22" y2="30" className="stroke-red-600" strokeWidth="2" />
        <line x1="22" y1="6" x2="6" y2="30" className="stroke-red-600" strokeWidth="2" />
      </g>
    );
  }
  if (status === "IMPLANT") {
    return (
      <g className="pointer-events-none">
        <rect x="12" y="10" width="4" height="14" rx="1" className="fill-purple-600" />
        <line x1="10" y1="14" x2="18" y2="14" className="stroke-purple-800" strokeWidth="1" />
        <line x1="10" y1="18" x2="18" y2="18" className="stroke-purple-800" strokeWidth="1" />
      </g>
    );
  }
  if (status === "CROWN") {
    return (
      <g className="pointer-events-none">
        <path
          d="M8 8 L20 8 L18 4 L10 4 Z"
          className="fill-amber-500 stroke-amber-700"
          strokeWidth="1"
        />
      </g>
    );
  }
  if (status === "BRIDGE") {
    return (
      <foreignObject x="18" y="14" width="12" height="12" className="pointer-events-none">
        <Link2 className="h-3 w-3 text-indigo-600" />
      </foreignObject>
    );
  }
  return null;
}

export function ToothSvg({
  fdiNumber,
  displayNumber,
  conditions,
  selected,
  onClick,
  disabled,
  highlightSurfaces,
}: {
  fdiNumber: string;
  displayNumber: string;
  conditions: { type: ToothConditionType; surfaces?: string[] }[];
  selected?: boolean;
  onClick?: () => void;
  disabled?: boolean;
  highlightSurfaces?: ToothSurface[];
}) {
  const types = conditions.map((c) => c.type);
  const primary = getPrimaryConditionType(types);
  const status = deriveToothStatus(conditions);
  const surfaceMap = getSurfaceFindings(conditions);
  const isMissing = status === "MISSING";

  const bodyClass = primary
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
        !disabled && "hover:scale-105",
        selected && "scale-105",
        disabled && "cursor-not-allowed opacity-60",
        isMissing && "opacity-40",
      )}
    >
      <svg
        width="40"
        height="48"
        viewBox="0 0 28 36"
        className={cn(
          selected && "drop-shadow-md ring-2 ring-primary/50 rounded-sm",
          isMissing && "grayscale",
        )}
      >
        <path
          d="M14 2 C8 2 4 8 4 14 C4 22 6 30 8 34 L20 34 C22 30 24 22 24 14 C24 8 20 2 14 2 Z"
          className={cn(bodyClass, "stroke-[1.5]")}
        />

        {CHART_SURFACES.map((surface) => {
          const finding = surfaceMap.get(surface);
          const highlighted = highlightSurfaces?.includes(surface);
          return (
            <path
              key={`${fdiNumber}-${surface}`}
              d={SURFACE_PATHS[surface]}
              className={cn(
                surfaceFillClass(finding),
                surfaceStrokeClass(finding),
                "stroke-[0.5] opacity-80",
                highlighted && "stroke-primary stroke-[1.5] opacity-100",
              )}
            />
          );
        })}

        <StatusOverlay status={status} />
      </svg>

      <span className="text-[10px] font-semibold text-muted-foreground group-hover:text-foreground">
        {displayNumber}
      </span>

      {conditions.length > 0 && !isMissing && (
        <div className="flex max-w-[40px] flex-wrap justify-center gap-0.5">
          {[...new Set(types)].slice(0, 3).map((type) => (
            <span
              key={`${fdiNumber}-${type}`}
              className={cn("h-1.5 w-1.5 rounded-full", CONDITION_DOT_COLORS[type])}
              title={formatConditionType(type)}
            />
          ))}
          {types.length > 3 && (
            <span className="text-[8px] text-muted-foreground">+{types.length - 3}</span>
          )}
        </div>
      )}

      {status === "CROWN" && (
        <Crown className="h-3 w-3 text-amber-600" aria-hidden />
      )}
      {status === "MISSING" && <X className="h-3 w-3 text-gray-500" aria-hidden />}
    </button>
  );
}
