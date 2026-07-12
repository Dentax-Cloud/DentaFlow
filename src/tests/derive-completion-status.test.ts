import { describe, expect, it } from "vitest";
import { deriveCompletionFromProcedureLineStatuses } from "@/lib/appointments/derive-completion-status";

describe("deriveCompletionFromProcedureLineStatuses", () => {
  it("returns no-op when there are zero procedure lines", () => {
    expect(deriveCompletionFromProcedureLineStatuses([])).toEqual({ kind: "no-op" });
  });

  it("returns pending when any line is IN_PROGRESS", () => {
    expect(deriveCompletionFromProcedureLineStatuses(["CLOSED", "IN_PROGRESS"])).toEqual({
      kind: "pending",
    });
  });

  it("returns eligible when all lines are CLOSED or VOIDED", () => {
    expect(deriveCompletionFromProcedureLineStatuses(["CLOSED", "VOIDED"])).toEqual({
      kind: "eligible",
    });
  });

  it("returns eligible when all lines are terminal including LOCKED", () => {
    expect(deriveCompletionFromProcedureLineStatuses(["LOCKED", "CLOSED"])).toEqual({
      kind: "eligible",
    });
  });

  it("returns pending for unknown non-terminal statuses", () => {
    expect(deriveCompletionFromProcedureLineStatuses(["CLOSED", "DRAFT"])).toEqual({
      kind: "pending",
    });
  });
});
