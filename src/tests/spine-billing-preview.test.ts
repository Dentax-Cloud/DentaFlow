import { describe, expect, it } from "vitest";
import { buildSpineBillingPreview } from "@/lib/encounter/billing-preview";

describe("buildSpineBillingPreview", () => {
  it("includes completed lines in billable totals and excludes planned", () => {
    const preview = buildSpineBillingPreview({
      lines: [
        {
          id: "line-completed",
          status: "completed",
          billedInvoiceId: null,
          unitPrice: 100,
          procedureCatalog: { code: "D1110", name: "Prophy", price: 100 },
          materialUsages: [{ quantity: 2, unitCost: 5.5, itemName: "Paste" }],
        },
        {
          id: "line-planned",
          status: "planned",
          billedInvoiceId: null,
          unitPrice: 250,
          procedureCatalog: { code: "D2740", name: "Crown", price: 250 },
          materialUsages: [{ quantity: 1, unitCost: 40, itemName: "Cement" }],
        },
      ],
      estimatedCoverage: 60,
      estimatedCopay: 51,
    });

    expect(preview.lines).toHaveLength(2);
    expect(preview.lines[0]).toMatchObject({
      id: "line-completed",
      billable: true,
      unitPrice: 100,
      materialsCost: 11,
    });
    expect(preview.lines[1]).toMatchObject({
      id: "line-planned",
      billable: false,
      unitPrice: 250,
      materialsCost: 40,
    });

    expect(preview.proceduresSubtotal).toBe(350);
    expect(preview.materialsSubtotal).toBe(51);
    expect(preview.billableSubtotal).toBe(111);
    expect(preview.projectedTotal).toBe(111);
    expect(preview.estimatedCoverage).toBe(60);
    expect(preview.estimatedCopay).toBe(51);
    expect(preview.gateMessage).toBeNull();
  });

  it("returns a gate message when nothing is billable", () => {
    const preview = buildSpineBillingPreview({
      lines: [
        {
          id: "line-planned",
          status: "planned",
          unitPrice: null,
          procedureCatalog: { code: "D0150", name: "Exam", price: 75 },
          materialUsages: [],
        },
      ],
    });

    expect(preview.billableSubtotal).toBe(0);
    expect(preview.gateMessage).toMatch(/No billable/i);
  });
});
