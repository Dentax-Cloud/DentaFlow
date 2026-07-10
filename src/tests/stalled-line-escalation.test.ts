import { describe, expect, it } from "vitest";
import { isPrismaUniqueViolation, workerClaimLogId } from "@/worker/claim";

describe("stalled line escalation idempotency keys", () => {
  it("uses stable claim ids per line and alert kind", () => {
    const lineId = "line_abc123";
    expect(workerClaimLogId("stalled_line_warn", lineId)).toBe(
      "wclaim_stalled_line_warn_line_abc123",
    );
    expect(workerClaimLogId("stalled_line_escalate", lineId)).toBe(
      "wclaim_stalled_line_escalate_line_abc123",
    );
    expect(workerClaimLogId("stalled_line_warn", lineId)).not.toBe(
      workerClaimLogId("stalled_line_escalate", lineId),
    );
  });

  it("detects prisma unique violations for duplicate claims", () => {
    expect(isPrismaUniqueViolation({ code: "P2002" })).toBe(true);
    expect(isPrismaUniqueViolation(new Error("nope"))).toBe(false);
  });
});
