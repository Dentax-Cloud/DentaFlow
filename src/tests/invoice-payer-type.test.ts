import { describe, expect, it } from "vitest";
import {
  invoicePayerTypeLabel,
  resolveInvoicePayerType,
} from "@/lib/billing/invoice-payer-type";
import type { InsuranceCalculation } from "@/lib/billing/insurance-calculator";

function split(partial: Partial<InsuranceCalculation>): InsuranceCalculation {
  return {
    totalAmount: 100,
    insurerAmount: 0,
    patientAmount: 100,
    coPayPercent: 100,
    preAuthRequired: false,
    providerName: "Test",
    networkName: "Network",
    policyId: "pol_1",
    preAuthReference: null,
    ...partial,
  };
}

describe("resolveInvoicePayerType", () => {
  it("maps null split to SELF_PAY", () => {
    expect(resolveInvoicePayerType(null)).toBe("SELF_PAY");
    expect(resolveInvoicePayerType(undefined)).toBe("SELF_PAY");
  });

  it("maps patient-only responsibility to SELF_PAY", () => {
    expect(
      resolveInvoicePayerType(split({ insurerAmount: 0, patientAmount: 100 })),
    ).toBe("SELF_PAY");
  });

  it("maps full insurer coverage to INSURANCE", () => {
    expect(
      resolveInvoicePayerType(split({ insurerAmount: 100, patientAmount: 0 })),
    ).toBe("INSURANCE");
  });

  it("maps shared responsibility to CO_PAY", () => {
    expect(
      resolveInvoicePayerType(
        split({ insurerAmount: 80, patientAmount: 20, coPayPercent: 20 }),
      ),
    ).toBe("CO_PAY");
  });
});

describe("invoicePayerTypeLabel", () => {
  it("uses UI labels for uppercase DB enum values", () => {
    expect(invoicePayerTypeLabel("SELF_PAY")).toBe("Self-pay");
    expect(invoicePayerTypeLabel("INSURANCE")).toBe("Insurance");
    expect(invoicePayerTypeLabel("CO_PAY")).toBe("Co-pay");
  });
});
