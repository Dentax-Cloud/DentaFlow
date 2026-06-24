import { ToothConditionType } from "@prisma/client";

export const CONDITION_COLORS: Record<ToothConditionType, string> = {
  HEALTHY: "fill-emerald-100 stroke-emerald-600",
  CARIES: "fill-red-200 stroke-red-600",
  RESTORATION: "fill-blue-200 stroke-blue-600",
  CROWN: "fill-amber-200 stroke-amber-600",
  IMPLANT: "fill-purple-200 stroke-purple-600",
  MISSING: "fill-gray-200 stroke-gray-400 opacity-50",
  PERIO_POCKET: "fill-orange-200 stroke-orange-600",
  MOBILITY: "fill-pink-200 stroke-pink-600",
  FRACTURE: "fill-rose-300 stroke-rose-700",
  ROOT_CANAL: "fill-cyan-200 stroke-cyan-600",
  WATCH: "fill-yellow-200 stroke-yellow-600",
  BRIDGE: "fill-indigo-200 stroke-indigo-600",
};

export const CONDITION_DOT_COLORS: Record<ToothConditionType, string> = {
  HEALTHY: "bg-emerald-500",
  CARIES: "bg-red-500",
  RESTORATION: "bg-blue-500",
  CROWN: "bg-amber-500",
  IMPLANT: "bg-purple-500",
  MISSING: "bg-gray-400",
  PERIO_POCKET: "bg-orange-500",
  MOBILITY: "bg-pink-500",
  FRACTURE: "bg-rose-600",
  ROOT_CANAL: "bg-cyan-500",
  WATCH: "bg-yellow-500",
  BRIDGE: "bg-indigo-500",
};

/** Highest priority wins for tooth fill color when multiple conditions exist. */
export const CONDITION_PRIORITY: ToothConditionType[] = [
  ToothConditionType.MISSING,
  ToothConditionType.IMPLANT,
  ToothConditionType.BRIDGE,
  ToothConditionType.CROWN,
  ToothConditionType.ROOT_CANAL,
  ToothConditionType.CARIES,
  ToothConditionType.FRACTURE,
  ToothConditionType.RESTORATION,
  ToothConditionType.WATCH,
  ToothConditionType.PERIO_POCKET,
  ToothConditionType.MOBILITY,
  ToothConditionType.HEALTHY,
];

export const QUICK_FINDINGS: { type: ToothConditionType; label: string }[] = [
  { type: ToothConditionType.CARIES, label: "Caries" },
  { type: ToothConditionType.RESTORATION, label: "Restoration" },
  { type: ToothConditionType.MISSING, label: "Missing" },
  { type: ToothConditionType.CROWN, label: "Crown" },
  { type: ToothConditionType.ROOT_CANAL, label: "Root canal" },
  { type: ToothConditionType.WATCH, label: "Watch" },
];

export function formatConditionType(type: ToothConditionType): string {
  return type.replace(/_/g, " ").toLowerCase();
}

export function getPrimaryConditionType(
  types: ToothConditionType[],
): ToothConditionType | undefined {
  for (const priority of CONDITION_PRIORITY) {
    if (types.includes(priority)) return priority;
  }
  return types[0];
}
