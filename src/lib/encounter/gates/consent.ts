import type { ConsentRecord } from "@prisma/client";

export type ConsentGateSpineResult =
  | { cleared: true; record: ConsentRecord }
  | { cleared: false; reason: string; record: ConsentRecord | null };

/**
 * Gate 2a — clinical consent (runs in parallel with insurance after risk clears).
 * Read-safe: never throws; missing/revoked → cleared:false + reason.
 */
export function evaluateConsentGate(
  record: ConsentRecord | null,
): ConsentGateSpineResult {
  if (!record || record.revokedAt) {
    return {
      cleared: false,
      reason: "Clinical consent has not been granted for this encounter.",
      record: record?.revokedAt ? record : null,
    };
  }
  if (record.purpose !== "clinical") {
    return {
      cleared: false,
      reason: "No clinical-purpose consent record found.",
      record,
    };
  }
  return { cleared: true, record };
}
