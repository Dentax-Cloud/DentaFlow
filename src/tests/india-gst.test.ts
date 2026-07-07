import { describe, expect, it } from "vitest";
import {
  INDIA_EXEMPT_SERVICE_SAC,
  calculateIndiaGstInvoice,
  gstStateFromGstin,
  isInterStateGst,
  splitIndiaGstAmounts,
} from "@/lib/billing/india-gst";

describe("india-gst", () => {
  it("uses SAC 999319 for exempt service lines", () => {
    const result = calculateIndiaGstInvoice(
      [
        {
          description: "Root canal",
          quantity: 1,
          unitPrice: 5000,
          procedureCode: "D3310",
        },
      ],
      { clinicGstState: "27", patientStateCode: "27" },
    );

    expect(result.lines[0].itemType).toBe("SERVICE");
    expect(result.lines[0].hsnSacCode).toBe(INDIA_EXEMPT_SERVICE_SAC);
    expect(result.lines[0].gstRate).toBe(0);
    expect(result.tax).toBe(0);
    expect(result.exemptSubtotal).toBe(5000);
    expect(result.total).toBe(5000);
  });

  it("splits CGST+SGST for same-state taxable goods", () => {
    const result = calculateIndiaGstInvoice(
      [
        {
          description: "Toothpaste",
          quantity: 2,
          unitPrice: 100,
          inventoryItemId: "inv-1",
          gstRatePercent: 18,
          hsnCode: "3306",
        },
      ],
      { clinicGstState: "27", patientStateCode: "27" },
    );

    expect(result.lines[0].itemType).toBe("GOOD");
    expect(result.lines[0].hsnSacCode).toBe("3306");
    expect(result.taxableSubtotal).toBe(200);
    expect(result.cgstTotal).toBe(18);
    expect(result.sgstTotal).toBe(18);
    expect(result.igstTotal).toBe(0);
    expect(result.tax).toBe(36);
    expect(result.total).toBe(236);
  });

  it("uses IGST for inter-state goods", () => {
    const result = calculateIndiaGstInvoice(
      [
        {
          description: "Mouthwash",
          quantity: 1,
          unitPrice: 200,
          inventoryItemId: "inv-2",
          gstRatePercent: 12,
          hsnCode: "3306",
        },
      ],
      { clinicGstState: "27", patientStateCode: "29" },
    );

    expect(result.cgstTotal).toBe(0);
    expect(result.sgstTotal).toBe(0);
    expect(result.igstTotal).toBe(24);
    expect(result.total).toBe(224);
  });

  it("combines exempt services and taxable goods on one invoice", () => {
    const result = calculateIndiaGstInvoice(
      [
        {
          description: "Cleaning",
          quantity: 1,
          unitPrice: 1500,
          procedureCode: "D1110",
        },
        {
          description: "Electric brush",
          quantity: 1,
          unitPrice: 800,
          inventoryItemId: "inv-3",
          gstRatePercent: 18,
          hsnCode: "8509",
        },
      ],
      { clinicGstState: "27", patientStateCode: "27" },
    );

    expect(result.exemptSubtotal).toBe(1500);
    expect(result.taxableSubtotal).toBe(800);
    expect(result.subtotal).toBe(2300);
    expect(result.cgstTotal).toBe(72);
    expect(result.sgstTotal).toBe(72);
    expect(result.total).toBe(2444);
  });

  it("derives state code from GSTIN prefix", () => {
    expect(gstStateFromGstin("27AAPFU0939F1ZV")).toBe("27");
    expect(isInterStateGst("27", "27")).toBe(false);
    expect(isInterStateGst("27", "29")).toBe(true);
  });

  it("splitIndiaGstAmounts returns zero for exempt rate", () => {
    expect(splitIndiaGstAmounts(1000, 0, false)).toEqual({
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
    });
  });
});
