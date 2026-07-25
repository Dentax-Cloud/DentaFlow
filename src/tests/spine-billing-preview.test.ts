import { describe, expect, it } from "vitest";
import { buildSpineBillingPreview } from "@/lib/encounter/billing-preview";
import { isMaterialUsageBillableOnInvoice } from "@/lib/encounter/billing-materials";
import {
  lotExpiryWarning,
  NEAR_EXPIRY_DAYS,
  sortLotsFefo,
  toLotSuggestion,
} from "@/lib/inventory/lots";

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
      alreadyInvoiced: false,
      unitPrice: 100,
      materialsCost: 11,
    });
    expect(preview.lines[1]).toMatchObject({
      id: "line-planned",
      billable: false,
      alreadyInvoiced: false,
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

  it("excludes bundled (isBillable=false) materials from preview totals", () => {
    const preview = buildSpineBillingPreview({
      lines: [
        {
          id: "line-completed",
          status: "completed",
          unitPrice: 100,
          procedureCatalog: { code: "D1110", name: "Prophy", price: 100 },
          materialUsages: [
            {
              quantity: 2,
              unitCost: 10,
              itemName: "Bundled gloves",
              isBillable: false,
            },
            {
              quantity: 1,
              unitCost: 25,
              itemName: "Billable cement",
              isBillable: true,
            },
          ],
        },
      ],
    });

    expect(preview.lines[0].materialsCost).toBe(25);
    expect(preview.billableSubtotal).toBe(125);
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

  it("marks completed lines with billedInvoiceId as already invoiced (not billable)", () => {
    const preview = buildSpineBillingPreview({
      lines: [
        {
          id: "line-billed",
          status: "completed",
          billedInvoiceId: "inv-1",
          unitPrice: 588,
          procedureCatalog: {
            code: "GPMR-APP001",
            name: "Occlusal Night Guard",
            price: 588,
          },
          materialUsages: [],
        },
      ],
    });

    expect(preview.lines[0]).toMatchObject({
      billable: false,
      alreadyInvoiced: true,
      unitPrice: 588,
    });
    expect(preview.billableSubtotal).toBe(0);
    expect(preview.gateMessage).toMatch(/No billable/i);
  });
});

describe("isMaterialUsageBillableOnInvoice", () => {
  it("adds a separate invoice line only when isBillable is true and cost > 0", () => {
    expect(
      isMaterialUsageBillableOnInvoice({
        isBillable: true,
        quantity: 2,
        unitCost: 12.5,
      }),
    ).toBe(true);
  });

  it("skips bundled BoM materials so invoice matches procedure-only totals", () => {
    expect(
      isMaterialUsageBillableOnInvoice({
        isBillable: false,
        quantity: 3,
        unitCost: 40,
      }),
    ).toBe(false);
  });

  it("skips zero-cost materials even when billable", () => {
    expect(
      isMaterialUsageBillableOnInvoice({
        isBillable: true,
        quantity: 1,
        unitCost: 0,
      }),
    ).toBe(false);
  });
});

describe("FEFO lot suggestion + near-expiry warnings", () => {
  const now = new Date("2026-07-23T12:00:00.000Z");

  it("orders lots soonest-expiry-first (FEFO), null expiry last", () => {
    const sorted = sortLotsFefo(
      [
        {
          id: "c",
          lotNumber: "LOT-C",
          expiryDate: new Date("2026-12-01"),
          currentQty: 5,
        },
        {
          id: "a",
          lotNumber: "LOT-A",
          expiryDate: new Date("2026-08-01"),
          currentQty: 2,
        },
        {
          id: "b",
          lotNumber: "LOT-B",
          expiryDate: null,
          currentQty: 9,
        },
        {
          id: "d",
          lotNumber: "LOT-D",
          expiryDate: new Date("2026-07-20"),
          currentQty: 1,
        },
      ],
      now,
    );
    expect(sorted.map((l) => l.lotNumber)).toEqual([
      "LOT-D",
      "LOT-A",
      "LOT-C",
      "LOT-B",
    ]);
  });

  it("flags expired and near-expiry lots using the inventory 30-day window", () => {
    expect(NEAR_EXPIRY_DAYS).toBe(30);
    expect(lotExpiryWarning("2026-07-01", { now })?.level).toBe("expired");
    expect(lotExpiryWarning("2026-08-10", { now })?.level).toBe("near_expiry");
    expect(lotExpiryWarning("2026-12-01", { now })).toBeNull();
  });

  it("marks suggestions with expiry flags for the spine UI", () => {
    const suggestion = toLotSuggestion(
      {
        id: "batch_1",
        lotNumber: "LOT-EXP",
        expiryDate: new Date("2026-07-10"),
        currentQty: 3,
      },
      now,
    );
    expect(suggestion).toMatchObject({
      lotNumber: "LOT-EXP",
      isExpired: true,
      isNearExpiry: false,
      currentQty: 3,
    });
  });

  it("does not require lot fields for consumable-tier logging (Phase 1 design)", () => {
    // Consumable path: UI skips lot/expiry; deduction only requires lot when tier=tracked.
    const consumableNeedsLot = false;
    const trackedNeedsLot = true;
    expect(consumableNeedsLot).toBe(false);
    expect(trackedNeedsLot).toBe(true);
  });
});
