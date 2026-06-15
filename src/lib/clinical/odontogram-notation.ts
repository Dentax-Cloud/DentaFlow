/** FDI tooth numbers per arch (internal storage format). */
export const FDI_UPPER = [
  "18", "17", "16", "15", "14", "13", "12", "11",
  "21", "22", "23", "24", "25", "26", "27", "28",
] as const;

export const FDI_LOWER = [
  "48", "47", "46", "45", "44", "43", "42", "41",
  "31", "32", "33", "34", "35", "36", "37", "38",
] as const;

export type ChartNotation = "FDI" | "UNIVERSAL";

/** ISO FDI → ADA Universal (1–32). */
export const FDI_TO_UNIVERSAL: Record<string, string> = {
  "18": "1", "17": "2", "16": "3", "15": "4", "14": "5", "13": "6", "12": "7", "11": "8",
  "21": "9", "22": "10", "23": "11", "24": "12", "25": "13", "26": "14", "27": "15", "28": "16",
  "38": "17", "37": "18", "36": "19", "35": "20", "34": "21", "33": "22", "32": "23", "31": "24",
  "41": "25", "42": "26", "43": "27", "44": "28", "45": "29", "46": "30", "47": "31", "48": "32",
};

export const UNIVERSAL_TO_FDI: Record<string, string> = Object.fromEntries(
  Object.entries(FDI_TO_UNIVERSAL).map(([fdi, uni]) => [uni, fdi]),
);

export function getDisplayNumber(fdiNumber: string, notation: ChartNotation): string {
  if (notation === "FDI") return fdiNumber;
  return FDI_TO_UNIVERSAL[fdiNumber] ?? fdiNumber;
}

export function getArchTeeth(notation: ChartNotation): { upper: string[]; lower: string[] } {
  if (notation === "FDI") {
    return { upper: [...FDI_UPPER], lower: [...FDI_LOWER] };
  }
  return {
    upper: FDI_UPPER.map((n) => FDI_TO_UNIVERSAL[n] ?? n),
    lower: FDI_LOWER.map((n) => FDI_TO_UNIVERSAL[n] ?? n),
  };
}

/** Map display label (Universal) back to FDI storage key. */
export function toFdiNumber(displayNumber: string, notation: ChartNotation): string {
  if (notation === "FDI") return displayNumber;
  return UNIVERSAL_TO_FDI[displayNumber] ?? displayNumber;
}
