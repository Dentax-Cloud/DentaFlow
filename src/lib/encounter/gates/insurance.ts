import type { InsuranceVerification } from "@prisma/client";

export type InsuranceGateResult =
  | { cleared: true; verification: InsuranceVerification; stale: boolean }
  | { cleared: false; reason: string; verification: InsuranceVerification | null; stale: boolean };

const MIN_STALE_MINUTES = 12 * 60;
const MAX_STALE_MINUTES = 72 * 60;
const DEFAULT_STALE_MINUTES = 24 * 60;

export function clampStaleAfterMinutes(minutes: number | null | undefined): number {
  const value = minutes ?? DEFAULT_STALE_MINUTES;
  return Math.min(MAX_STALE_MINUTES, Math.max(MIN_STALE_MINUTES, value));
}

export function isVerificationStale(
  verification: Pick<InsuranceVerification, "verifiedAt" | "staleAfterMinutes">,
  now: Date = new Date(),
): boolean {
  if (!verification.verifiedAt) return true;
  const staleMs = clampStaleAfterMinutes(verification.staleAfterMinutes) * 60_000;
  return now.getTime() - verification.verifiedAt.getTime() > staleMs;
}

/**
 * Gate 2b — insurance eligibility (parallel with consent after risk clears).
 * Pre-auth denial blocks unless overridden via overridePreAuthGate.
 * Read-safe: never throws; missing verification → cleared:false + reason.
 */
export function evaluateInsuranceGate(
  verification: InsuranceVerification | null,
  options?: { preAuthOverridden?: boolean; now?: Date },
): InsuranceGateResult {
  if (!verification) {
    return {
      cleared: false,
      reason: "Insurance verification has not been recorded.",
      verification: null,
      stale: true,
    };
  }

  const stale = isVerificationStale(verification, options?.now);
  if (stale) {
    return {
      cleared: false,
      reason: "Insurance verification is stale and must be re-checked.",
      verification,
      stale: true,
    };
  }

  if (verification.eligibilityStatus === "ineligible") {
    return {
      cleared: false,
      reason: "Patient is not eligible under current coverage.",
      verification,
      stale: false,
    };
  }

  if (
    verification.preAuthStatus === "denied" &&
    !options?.preAuthOverridden
  ) {
    return {
      cleared: false,
      reason: "Pre-authorization was denied. Override required to proceed.",
      verification,
      stale: false,
    };
  }

  if (
    verification.eligibilityStatus !== "eligible" &&
    verification.eligibilityStatus !== "unknown"
  ) {
    return {
      cleared: false,
      reason: `Eligibility status is ${verification.eligibilityStatus}.`,
      verification,
      stale: false,
    };
  }

  return { cleared: true, verification, stale: false };
}

/** Chip vocabulary shared by Gate Summary and Running Total. */
export type InsuranceUiChipStatus =
  | "cleared"
  | "blocked"
  | "overridden"
  | "pending"
  | "unknown";

export type InsuranceUiDisplay = {
  chipStatus: InsuranceUiChipStatus;
  /** When set, UI may render the label as `Insurance (${reasonTag})`. */
  reasonTag?: "stale";
};

/**
 * Canonical insurance chip for Gate Summary + Running Total.
 * Derives from evaluateInsuranceGate; pre-auth override matches EncounterGateSummary.
 */
export function resolveInsuranceUiDisplay(params: {
  verification: InsuranceVerification | null;
  preAuthOverridden?: boolean;
  now?: Date;
}): InsuranceUiDisplay {
  if (params.preAuthOverridden) {
    return { chipStatus: "overridden" };
  }

  const result = evaluateInsuranceGate(params.verification, {
    preAuthOverridden: params.preAuthOverridden,
    now: params.now,
  });

  if (result.cleared) {
    return { chipStatus: "cleared" };
  }

  return {
    chipStatus: "blocked",
    reasonTag:
      result.verification != null && result.stale ? "stale" : undefined,
  };
}
