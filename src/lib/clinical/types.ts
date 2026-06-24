/** Shared clinical types for the DentaFlow clinical suite. */

export type ToothSurface = "M" | "D" | "O" | "B" | "L" | "I" | "V";
export type Arch = "UPPER" | "LOWER";
export type Quadrant = "UL" | "UR" | "LL" | "LR";

export type ToothStatus =
  | "PRESENT"
  | "MISSING"
  | "IMPLANT"
  | "BRIDGE"
  | "UNERUPTED"
  | "IMPACTED";

export type ConditionType =
  | "CARIES"
  | "RESTORATION"
  | "CROWN"
  | "MISSING"
  | "FRACTURE"
  | "ROOT_CANAL"
  | "IMPLANT"
  | "BRIDGE_PONTIC"
  | "BRIDGE_RETAINER"
  | "PERIODONTAL"
  | "WATCH"
  | "EXTRACTION_SITE"
  | "VENEER"
  | "INLAY";

export type PerioMeasurement = {
  toothNumber: number;
  buccalDepths: [number, number, number];
  buccalBleeding: [boolean, boolean, boolean];
  buccalRecession: [number, number, number];
  lingualDepths: [number, number, number];
  lingualBleeding: [boolean, boolean, boolean];
  lingualRecession: [number, number, number];
  mobility: 0 | 1 | 2 | 3;
  furcation: 0 | 1 | 2 | 3;
};

export type RiskLevel = "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH";

/** Primary charting surfaces (occlusal/incisal shown as O). */
export const CHART_SURFACES: ToothSurface[] = ["M", "D", "O", "B", "L"];

export const SURFACE_LABELS: Record<ToothSurface, string> = {
  M: "Mesial",
  D: "Distal",
  O: "Occlusal",
  B: "Buccal",
  L: "Lingual",
  I: "Incisal",
  V: "Vestibular",
};
