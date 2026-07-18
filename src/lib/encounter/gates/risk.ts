import type { RiskAssessment } from "@prisma/client";

export type RiskGateResult =
  | { cleared: true; assessment: RiskAssessment }
  | { cleared: false; reason: string; assessment: RiskAssessment | null };

/**
 * Gate 1 — risk assessment must clear before consent/insurance (parallel).
 * Read-safe: never throws; missing assessment → cleared:false + reason.
 */
export function evaluateRiskGate(assessment: RiskAssessment | null): RiskGateResult {
  if (!assessment) {
    return { cleared: false, reason: "Risk assessment has not been recorded.", assessment: null };
  }
  if (!assessment.clearedAt) {
    return {
      cleared: false,
      reason: "Risk assessment is pending clearance.",
      assessment,
    };
  }
  return { cleared: true, assessment };
}
