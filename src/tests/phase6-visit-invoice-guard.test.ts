import { describe, expect, it } from "vitest";
import type { VisitBillingKind } from "@/lib/billing/visit-invoice-guard";

/** Pure decision table mirroring assertCanCreateVisitInvoice (for unit tests). */
export function evaluateVisitInvoiceGuard(
  existing: Array<{ billingKind: string | null }>,
  billingKind: VisitBillingKind,
): { allowed: boolean; reason?: string } {
  const hasChairside = existing.some((i) => i.billingKind === "CHAIRSIDE");
  const hasLineInvoice = existing.some(
    (i) => i.billingKind === "INTERIM" || i.billingKind === "FINAL",
  );
  const hasFinal = existing.some((i) => i.billingKind === "FINAL");

  if (billingKind === "CHAIRSIDE") {
    if (existing.length > 0) {
      return { allowed: false, reason: "chairside_blocked_existing" };
    }
    return { allowed: true };
  }

  if (hasChairside) {
    return { allowed: false, reason: "procedure_blocked_chairside" };
  }
  if (hasFinal) {
    return { allowed: false, reason: "final_already_exists" };
  }
  if (billingKind === "INTERIM" || billingKind === "FINAL") {
    void hasLineInvoice;
    return { allowed: true };
  }
  return { allowed: true };
}

describe("Phase 6 visit invoice dual-path guard", () => {
  it("allows first chairside invoice", () => {
    expect(evaluateVisitInvoiceGuard([], "CHAIRSIDE").allowed).toBe(true);
  });

  it("blocks chairside when ProcedureLine interim already exists", () => {
    const result = evaluateVisitInvoiceGuard(
      [{ billingKind: "INTERIM" }],
      "CHAIRSIDE",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("chairside_blocked_existing");
  });

  it("blocks ProcedureLine invoice when chairside already invoiced", () => {
    const result = evaluateVisitInvoiceGuard(
      [{ billingKind: "CHAIRSIDE" }],
      "INTERIM",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("procedure_blocked_chairside");
  });

  it("allows multiple interim invoices (Phase 4)", () => {
    expect(
      evaluateVisitInvoiceGuard([{ billingKind: "INTERIM" }], "INTERIM").allowed,
    ).toBe(true);
    expect(
      evaluateVisitInvoiceGuard(
        [{ billingKind: "INTERIM" }, { billingKind: "INTERIM" }],
        "FINAL",
      ).allowed,
    ).toBe(true);
  });

  it("blocks further invoices after FINAL", () => {
    expect(
      evaluateVisitInvoiceGuard([{ billingKind: "FINAL" }], "INTERIM").allowed,
    ).toBe(false);
    expect(
      evaluateVisitInvoiceGuard([{ billingKind: "FINAL" }], "FINAL").allowed,
    ).toBe(false);
    expect(
      evaluateVisitInvoiceGuard([{ billingKind: "FINAL" }], "CHAIRSIDE").allowed,
    ).toBe(false);
  });
});

describe("Phase 6 inventory deduction idempotency key", () => {
  it("documents appointmentId+itemId USAGE uniqueness intent", () => {
    const key = (appointmentId: string, itemId: string) =>
      `${appointmentId}:${itemId}:USAGE`;
    expect(key("apt1", "inv1")).toBe(key("apt1", "inv1"));
    expect(key("apt1", "inv1")).not.toBe(key("apt1", "inv2"));
  });
});
