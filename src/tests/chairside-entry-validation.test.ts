import { describe, it, expect } from "vitest";
import {
  getChairsideEntryValidationIssues,
  validateChairsideSessionForFinalize,
  formatChairsideValidationError,
} from "@/lib/clinical/chairside-entry-validation";

describe("chairside entry validation", () => {
  it("accepts billable procedure with code and price", () => {
    const issues = getChairsideEntryValidationIssues({
      procedureCode: "D1110",
      procedureName: "Prophylaxis",
      unitPrice: 250,
      includeInInvoice: true,
    });
    expect(issues).toHaveLength(0);
  });

  it("rejects billable entry with no procedure", () => {
    const issues = getChairsideEntryValidationIssues({
      conditionType: "CARIES",
      unitPrice: 0,
      includeInInvoice: true,
    });
    expect(issues.some((i) => i.message.includes("procedure"))).toBe(true);
  });

  it("rejects billable entry with zero price", () => {
    const issues = getChairsideEntryValidationIssues({
      procedureCode: "D1110",
      procedureName: "Prophylaxis",
      unitPrice: 0,
      includeInInvoice: true,
    });
    expect(issues.some((i) => i.message.includes("price"))).toBe(true);
  });

  it("accepts non-billable clinical finding", () => {
    const issues = getChairsideEntryValidationIssues({
      conditionType: "CARIES",
      includeInInvoice: false,
    });
    expect(issues).toHaveLength(0);
  });

  it("rejects empty non-billable entry", () => {
    const issues = getChairsideEntryValidationIssues({
      includeInInvoice: false,
    });
    expect(issues).toHaveLength(1);
  });

  it("aggregates session validation issues", () => {
    const result = validateChairsideSessionForFinalize([
      {
        id: "1",
        procedureCode: "D1110",
        procedureName: "Prophylaxis",
        unitPrice: 100,
        includeInInvoice: true,
      },
      {
        id: "2",
        conditionType: "CARIES",
        includeInInvoice: true,
      },
    ]);
    expect(result.valid).toBe(false);
    expect(result.issues.length).toBeGreaterThan(0);
  });

  it("formats a user-facing validation error", () => {
    const message = formatChairsideValidationError([
      {
        entryLabel: "Caries",
        message: "Billable entries must include a procedure.",
      },
    ]);
    expect(message).toContain("Cannot finalize");
    expect(message).toContain("Caries");
  });
});
