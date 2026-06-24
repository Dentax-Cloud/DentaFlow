import type { ToothConditionType } from "@prisma/client";
import type { ToothSurface } from "./types";
import { CHART_SURFACES } from "./types";
import {
  CONDITION_DOT_COLORS,
  getPrimaryConditionType,
} from "./condition-config";

export type SurfaceFinding = {
  surface: ToothSurface;
  type: ToothConditionType;
};

/** Map each chart surface to its dominant condition type for coloring. */
export function getSurfaceFindings(
  conditions: { type: ToothConditionType; surfaces?: string[] }[],
): Map<ToothSurface, ToothConditionType> {
  const map = new Map<ToothSurface, ToothConditionType>();

  for (const condition of conditions) {
    const surfaces =
      condition.surfaces && condition.surfaces.length > 0
        ? (condition.surfaces as ToothSurface[])
        : CHART_SURFACES;

    for (const surface of surfaces) {
      if (!CHART_SURFACES.includes(surface)) continue;
      const existing = map.get(surface);
      if (!existing) {
        map.set(surface, condition.type);
      } else {
        const primary = getPrimaryConditionType([existing, condition.type]);
        if (primary) map.set(surface, primary);
      }
    }
  }

  return map;
}

export function surfaceFillClass(type: ToothConditionType | undefined): string {
  if (!type) return "fill-gray-50 dark:fill-slate-900";
  const dot = CONDITION_DOT_COLORS[type];
  return dot.replace("bg-", "fill-").replace("-500", "-200");
}

export function surfaceStrokeClass(type: ToothConditionType | undefined): string {
  if (!type) return "stroke-gray-300 dark:stroke-slate-600";
  const dot = CONDITION_DOT_COLORS[type];
  return dot.replace("bg-", "stroke-").replace("-500", "-600");
}

export function deriveToothStatus(
  conditions: { type: ToothConditionType }[],
): "PRESENT" | "MISSING" | "IMPLANT" | "BRIDGE" | "CROWN" {
  const types = conditions.map((c) => c.type);
  if (types.includes("MISSING")) return "MISSING";
  if (types.includes("IMPLANT")) return "IMPLANT";
  if (types.includes("BRIDGE")) return "BRIDGE";
  if (types.includes("CROWN")) return "CROWN";
  return "PRESENT";
}
