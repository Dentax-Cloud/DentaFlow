import { describe, it, expect } from "vitest";
import { ClaimStatus } from "@prisma/client";

/**
 * Pure helpers mirroring maybeCreateDraftClaimForInvoice eligibility rules
 * (kept here so the decision tree is unit-tested without DB).
 */
function shouldSuggestDraftClaim(params: {
  insuranceAmount: number;
  hasPrimaryPolicy: boolean;
  existingClaimStatuses: ClaimStatus[];
}): boolean {
  if (params.insuranceAmount <= 0) return false;
  if (!params.hasPrimaryPolicy) return false;
  const active = params.existingClaimStatuses.find(
    (s) =>
      s !== ClaimStatus.DENIED &&
      s !== ClaimStatus.WRITTEN_OFF &&
      s !== ClaimStatus.PAID,
  );
  return !active;
}

describe("claim auto-suggest eligibility", () => {
  it("suggests when insurance amount > 0 and primary policy exists", () => {
    expect(
      shouldSuggestDraftClaim({
        insuranceAmount: 120,
        hasPrimaryPolicy: true,
        existingClaimStatuses: [],
      }),
    ).toBe(true);
  });

  it("skips when insurance amount is zero", () => {
    expect(
      shouldSuggestDraftClaim({
        insuranceAmount: 0,
        hasPrimaryPolicy: true,
        existingClaimStatuses: [],
      }),
    ).toBe(false);
  });

  it("skips when patient has no primary policy", () => {
    expect(
      shouldSuggestDraftClaim({
        insuranceAmount: 120,
        hasPrimaryPolicy: false,
        existingClaimStatuses: [],
      }),
    ).toBe(false);
  });

  it("skips when an active claim already exists", () => {
    expect(
      shouldSuggestDraftClaim({
        insuranceAmount: 120,
        hasPrimaryPolicy: true,
        existingClaimStatuses: [ClaimStatus.DRAFT],
      }),
    ).toBe(false);
  });

  it("allows suggest after denied/paid terminal claims", () => {
    expect(
      shouldSuggestDraftClaim({
        insuranceAmount: 120,
        hasPrimaryPolicy: true,
        existingClaimStatuses: [ClaimStatus.DENIED, ClaimStatus.PAID],
      }),
    ).toBe(true);
  });
});
