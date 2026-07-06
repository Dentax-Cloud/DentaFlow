import type { ClaimSubmissionMethod } from "@prisma/client";

export type InsurerSubmissionOutcome =
  | {
      kind: "sent";
      providerName: string;
      email: string;
      message: string;
    }
  | {
      kind: "manual_required";
      providerName: string;
      portalUrl?: string;
      message: string;
    }
  | {
      kind: "no_config";
      providerName: string;
      message: string;
    };

export type ResolvedPayerConfig = {
  providerCode: string;
  providerName: string;
  claimEmail: string | null;
  claimSubmissionMethod: ClaimSubmissionMethod;
  claimsPortalUrl: string | null;
  turnaroundDays: number | null;
  contactPhone: string | null;
};

export function formatSubmissionMessage(outcome: InsurerSubmissionOutcome): string {
  return outcome.message;
}
