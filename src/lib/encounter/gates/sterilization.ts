/**
 * Gate 3 — sterilization is checked per-procedure (after parallel consent/insurance).
 * Phase 1 skeleton: accepts an explicit log present flag / timestamp from caller
 * until a dedicated sterilization log table is introduced.
 */
export type SterilizationLogInput = {
  procedureLineId: string;
  loggedAt: Date | null;
  instrumentSetId?: string | null;
};

export type SterilizationGateResult =
  | { cleared: true; procedureLineId: string }
  | { cleared: false; reason: string; procedureLineId: string };

export function evaluateSterilizationGate(
  input: SterilizationLogInput,
): SterilizationGateResult {
  if (!input.loggedAt) {
    return {
      cleared: false,
      reason: "Missing sterilization log for this procedure.",
      procedureLineId: input.procedureLineId,
    };
  }
  return { cleared: true, procedureLineId: input.procedureLineId };
}

export function evaluateSterilizationGates(
  logs: SterilizationLogInput[],
): SterilizationGateResult[] {
  return logs.map(evaluateSterilizationGate);
}
