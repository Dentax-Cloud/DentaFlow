import type { PerioMeasurement } from "./types";

export type PerioStagingResult = {
  stage: "I" | "II" | "III" | "IV";
  grade: "A" | "B" | "C";
  bopPercent: number;
  maxPocketDepth: number;
  sitesGt4: number;
  sitesGt6: number;
  affectedTeeth: number;
};

function allDepths(m: PerioMeasurement): number[] {
  return [...m.buccalDepths, ...m.lingualDepths];
}

function allBleeding(m: PerioMeasurement): boolean[] {
  return [...m.buccalBleeding, ...m.lingualBleeding];
}

export function calculatePerioStaging(measurements: PerioMeasurement[]): PerioStagingResult {
  if (!measurements.length) {
    return {
      stage: "I",
      grade: "A",
      bopPercent: 0,
      maxPocketDepth: 0,
      sitesGt4: 0,
      sitesGt6: 0,
      affectedTeeth: 0,
    };
  }

  let totalSites = 0;
  let bleedingSites = 0;
  let maxPocketDepth = 0;
  let sitesGt4 = 0;
  let sitesGt6 = 0;
  let affectedTeeth = 0;

  for (const m of measurements) {
    const depths = allDepths(m);
    const bleeding = allBleeding(m);

    totalSites += depths.length;
    bleedingSites += bleeding.filter(Boolean).length;

    const toothMax = Math.max(...depths, 0);
    if (toothMax > maxPocketDepth) maxPocketDepth = toothMax;
    if (toothMax >= 4) {
      sitesGt4 += depths.filter((d) => d >= 4).length;
      affectedTeeth++;
    }
    if (toothMax >= 6) sitesGt6 += depths.filter((d) => d >= 6).length;
  }

  const bopPercent =
    totalSites > 0 ? Math.round((bleedingSites / totalSites) * 100) : 0;

  let stage: PerioStagingResult["stage"];
  if (maxPocketDepth <= 3 && sitesGt4 === 0) stage = "I";
  else if (maxPocketDepth <= 4) stage = "II";
  else if (maxPocketDepth <= 5 || sitesGt6 <= 2) stage = "III";
  else stage = "IV";

  let grade: PerioStagingResult["grade"];
  if (bopPercent < 10 && affectedTeeth < 3) grade = "A";
  else if (bopPercent < 30) grade = "B";
  else grade = "C";

  return { stage, grade, bopPercent, maxPocketDepth, sitesGt4, sitesGt6, affectedTeeth };
}

export function getPocketDepthColor(depth: number): string {
  if (depth <= 3) return "#22c55e";
  if (depth <= 5) return "#eab308";
  return "#ef4444";
}

export function getPerioRiskLevel(
  staging: PerioStagingResult,
): "LOW" | "MODERATE" | "HIGH" | "VERY_HIGH" {
  if (staging.stage === "I" && staging.bopPercent < 15) return "LOW";
  if (staging.stage === "II" && staging.bopPercent < 25) return "MODERATE";
  if (staging.stage === "III") return "HIGH";
  return "VERY_HIGH";
}

export function comparePerioCharts(
  baseline: PerioMeasurement[],
  current: PerioMeasurement[],
): { improved: number; stable: number; deteriorated: number } {
  let improved = 0;
  let stable = 0;
  let deteriorated = 0;

  for (const curr of current) {
    const base = baseline.find((b) => b.toothNumber === curr.toothNumber);
    if (!base) continue;

    const baseMax = Math.max(...allDepths(base), 0);
    const currMax = Math.max(...allDepths(curr), 0);

    if (currMax < baseMax - 0.5) improved++;
    else if (currMax > baseMax + 0.5) deteriorated++;
    else stable++;
  }

  return { improved, stable, deteriorated };
}

export function toothMaxDepth(m: PerioMeasurement): number {
  return Math.max(...allDepths(m), 0);
}
