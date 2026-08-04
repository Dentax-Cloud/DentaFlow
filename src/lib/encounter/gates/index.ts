/**
 * Encounter gate orchestration (Module 6 architecture):
 * 1. Risk assessment clears first
 * 2. Consent + insurance eligibility proceed in parallel
 * 3. Sterilization is checked per-procedure
 *
 * Not wired into live procedure execution in Phase 1.
 */
import type { ConsentRecord, InsuranceVerification, RiskAssessment } from "@prisma/client";
import { evaluateRiskGate, type RiskGateResult } from "./risk";
import { evaluateConsentGate, type ConsentGateSpineResult } from "./consent";
import { evaluateInsuranceGate, type InsuranceGateResult } from "./insurance";
import {
  evaluateSterilizationGates,
  type SterilizationGateResult,
  type SterilizationLogInput,
} from "./sterilization";

export type GateBundleInput = {
  risk: RiskAssessment | null;
  consent: ConsentRecord | null;
  insurance: InsuranceVerification | null;
  sterilizationLogs: SterilizationLogInput[];
  preAuthOverridden?: boolean;
  now?: Date;
};

export type GateBundleResult = {
  risk: RiskGateResult;
  consent: ConsentGateSpineResult | null;
  insurance: InsuranceGateResult | null;
  sterilization: SterilizationGateResult[];
  /** True when risk cleared and both parallel gates cleared and all sterilization cleared. */
  allClear: boolean;
};

export function evaluateEncounterGates(input: GateBundleInput): GateBundleResult {
  const risk = evaluateRiskGate(input.risk);
  if (!risk.cleared) {
    return {
      risk,
      consent: null,
      insurance: null,
      sterilization: [],
      allClear: false,
    };
  }

  const consent = evaluateConsentGate(input.consent);
  const insurance = evaluateInsuranceGate(input.insurance, {
    preAuthOverridden: input.preAuthOverridden,
    now: input.now,
  });
  const sterilization = evaluateSterilizationGates(input.sterilizationLogs);

  const allClear =
    consent.cleared &&
    insurance.cleared &&
    sterilization.every((s) => s.cleared);

  return { risk, consent, insurance, sterilization, allClear };
}

export {
  canOverridePreAuth,
  overridePreAuthGate,
} from "./override";
export { evaluateRiskGate } from "./risk";
export { evaluateConsentGate } from "./consent";
export {
  evaluateInsuranceGate,
  clampStaleAfterMinutes,
  isVerificationStale,
  resolveInsuranceUiDisplay,
} from "./insurance";
export type { InsuranceUiChipStatus, InsuranceUiDisplay } from "./insurance";
export { evaluateSterilizationGate, evaluateSterilizationGates } from "./sterilization";
