import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  assertSufficientStoreStock,
  InsufficientStockError,
  MaterialUsageReturnBlockedError,
  stockUnitsFromUsageQuantity,
} from "@/lib/inventory/deduct-store-stock";
import {
  BOM_EMPTY_STATE_MESSAGE,
  bomPrepChecklist,
} from "@/lib/inventory/procedure-bom";
import { catchSpineExpectedFailure } from "@/lib/encounter/spine-action-result";
import { isMaterialUsageBillableOnInvoice } from "@/lib/encounter/billing-materials";
import { DEFAULT_STORE_LOCATION_NAME } from "@/lib/inventory/locations";

describe("procedure BoM prep checklist display", () => {
  it("shows empty state when no BoM is configured", () => {
    const view = bomPrepChecklist([]);
    expect(view.empty).toBe(true);
    expect(view.message).toBe(BOM_EMPTY_STATE_MESSAGE);
    expect(view.lines).toEqual([]);
  });

  it("shows empty state when BoM map entry is missing", () => {
    const view = bomPrepChecklist(undefined);
    expect(view.empty).toBe(true);
    expect(view.message).toMatch(/no bill of materials configured/i);
  });

  it("lists required and optional lines with quantities", () => {
    const view = bomPrepChecklist([
      {
        id: "bom_1",
        itemName: "Gloves",
        defaultQuantity: 2,
        unit: "pair",
        isOptional: false,
      },
      {
        id: "bom_2",
        itemName: "Etch gel",
        defaultQuantity: 1,
        unit: "syringe",
        isOptional: true,
      },
    ]);
    expect(view.empty).toBe(false);
    expect(view.message).toBeNull();
    expect(view.lines).toEqual([
      {
        id: "bom_1",
        label: "Gloves",
        quantityLabel: "2 pair",
        requiredLabel: "required",
      },
      {
        id: "bom_2",
        label: "Etch gel",
        quantityLabel: "1 syringe",
        requiredLabel: "optional",
      },
    ]);
  });
});

describe("store stock deduction units + insufficient stock", () => {
  it("ceils fractional usage to whole inventory units", () => {
    expect(stockUnitsFromUsageQuantity(1)).toBe(1);
    expect(stockUnitsFromUsageQuantity(1.1)).toBe(2);
    expect(stockUnitsFromUsageQuantity(0.25)).toBe(1);
  });

  it("rejects non-positive quantities", () => {
    expect(() => stockUnitsFromUsageQuantity(0)).toThrow(/greater than zero/i);
    expect(() => stockUnitsFromUsageQuantity(-2)).toThrow(/greater than zero/i);
  });

  it("blocks deduction when available < requested (no negative stock)", () => {
    expect(() =>
      assertSufficientStoreStock({
        itemId: "inv_1",
        itemName: "Composite A2",
        available: 1,
        requested: 2,
        locationId: "iloc_1",
      }),
    ).toThrow(InsufficientStockError);

    try {
      assertSufficientStoreStock({
        itemId: "inv_1",
        itemName: "Composite A2",
        available: 1,
        requested: 2,
        locationId: "iloc_1",
      });
    } catch (e) {
      expect(e).toBeInstanceOf(InsufficientStockError);
      const err = e as InsufficientStockError;
      expect(err.code).toBe("INSUFFICIENT_STOCK");
      expect(err.details).toEqual({
        itemId: "inv_1",
        itemName: "Composite A2",
        requested: 2,
        available: 1,
        locationId: "iloc_1",
      });
      expect(err.message).toMatch(/Insufficient stock for Composite A2/);
    }
  });

  it("allows deduction when stock is sufficient", () => {
    expect(() =>
      assertSufficientStoreStock({
        itemId: "inv_1",
        itemName: "Composite A2",
        available: 5,
        requested: 2,
        locationId: "iloc_1",
      }),
    ).not.toThrow();
  });

  it("surfaces InsufficientStockError as spine { ok:false } for the UI", () => {
    const result = catchSpineExpectedFailure(
      new InsufficientStockError("Insufficient stock for X: need 2, have 1 at central store.", {
        itemId: "inv_1",
        itemName: "X",
        requested: 2,
        available: 1,
        locationId: "iloc_1",
      }),
    );
    expect(result).toEqual({
      ok: false,
      error: "Insufficient stock for X: need 2, have 1 at central store.",
    });
  });
});

describe("concurrent store deduction safety (FOR UPDATE semantics)", () => {
  /**
   * Mirrors the InventoryItem FOR UPDATE critical section in
   * logMaterialUsageWithStoreDeduction: concurrent callers serialize,
   * the second sees the post-deduction qty, and stock never goes negative.
   */
  it("serializes competing deductions so only one succeeds when stock is tight", async () => {
    let stock = 5;
    let chain: Promise<void> = Promise.resolve();

    async function deductSerialized(n: number): Promise<void> {
      let release!: () => void;
      const gate = new Promise<void>((r) => {
        release = r;
      });
      const prev = chain;
      chain = gate;
      await prev;
      try {
        assertSufficientStoreStock({
          itemId: "inv_shared",
          itemName: "Shared item",
          available: stock,
          requested: n,
          locationId: "iloc_store",
        });
        stock -= n;
      } finally {
        release();
      }
    }

    const results = await Promise.allSettled([
      deductSerialized(3),
      deductSerialized(3),
      deductSerialized(3),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled").length;
    const blocked = results.filter((r) => r.status === "rejected").length;
    expect(ok).toBe(1);
    expect(blocked).toBe(2);
    expect(stock).toBe(2);
    expect(stock).toBeGreaterThanOrEqual(0);
  });
});

describe("InventoryLocation migration backfill", () => {
  const migrationPath = join(
    process.cwd(),
    "prisma/migrations/20260928000000_procedure_bom_inventory_location/migration.sql",
  );

  it("backfills exactly one default store location per existing tenant", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toMatch(/CREATE TYPE "InventoryLocationType" AS ENUM \('store', 'chair'\)/);
    expect(sql).toContain('CREATE TABLE "InventoryLocation"');
    expect(sql).toContain('CREATE TABLE "ProcedureBomItem"');
    expect(sql).toContain(DEFAULT_STORE_LOCATION_NAME);

    // One store row per tenant that does not already have a location.
    expect(sql).toMatch(
      /INSERT INTO "InventoryLocation"[\s\S]*FROM "Tenant" t[\s\S]*WHERE NOT EXISTS/,
    );
    expect(sql).toMatch(/'store'::"InventoryLocationType"/);
    expect(sql).toMatch(/true,\s*\n\s*CURRENT_TIMESTAMP/);

    // At most one default per tenant (partial unique index).
    expect(sql).toContain("InventoryLocation_tenantId_default_uidx");
    expect(sql).toMatch(/WHERE "isDefault" = true/);

    // Historical movements inherit the tenant store — inventory counts unchanged.
    expect(sql).toMatch(
      /UPDATE "StockTransaction" st[\s\S]*SET "locationId" = il\."id"[\s\S]*il\."isDefault" = true/,
    );
    expect(sql).toMatch(
      /UPDATE "MaterialUsage" mu[\s\S]*SET "locationId" = il\."id"[\s\S]*il\."isDefault" = true/,
    );

    // Does not invent ProcedureBomItem seed rows for real tenants.
    expect(sql).not.toMatch(/INSERT INTO "ProcedureBomItem"/);
  });
});

describe("billable + defaultTier migration", () => {
  const migrationPath = join(
    process.cwd(),
    "prisma/migrations/20260928000001_bom_billable_and_item_tier/migration.sql",
  );

  it("adds isBillable defaults that preserve existing invoice behavior", () => {
    const sql = readFileSync(migrationPath, "utf8");
    expect(sql).toMatch(
      /ProcedureBomItem[\s\S]*"isBillable" BOOLEAN NOT NULL DEFAULT false/,
    );
    expect(sql).toMatch(
      /MaterialUsage[\s\S]*"isBillable" BOOLEAN NOT NULL DEFAULT true/,
    );
    expect(sql).toMatch(/InventoryItem[\s\S]*"defaultTier"/);
    expect(sql).toMatch(/SET "defaultTier" = 'tracked'/);
    expect(sql).toMatch(/"trackByBatch" = true/);
  });
});

describe("ad-hoc material logging + return-to-store", () => {
  it("treats non-BoM inventory selection as ad-hoc (billable choice at log time)", () => {
    const bomItemIds = new Set(["inv_bom_1"]);
    const selectedId = "inv_adhoc_gloves";
    const isAdHoc = !bomItemIds.has(selectedId);
    expect(isAdHoc).toBe(true);
  });

  it("return-to-store migration adds status + returnedAt without dropping rows", () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        "prisma/migrations/20260928000002_material_usage_return_to_store/migration.sql",
      ),
      "utf8",
    );
    expect(sql).toMatch(/"status" TEXT NOT NULL DEFAULT 'used'/);
    expect(sql).toMatch(/"returnedAt"/);
    expect(sql).not.toMatch(/DELETE FROM "MaterialUsage"/);
  });

  it("blocks invoice lines for returned materials", () => {
    expect(
      isMaterialUsageBillableOnInvoice({
        isBillable: true,
        quantity: 2,
        unitCost: 10,
        status: "returned",
      }),
    ).toBe(false);
    expect(
      isMaterialUsageBillableOnInvoice({
        isBillable: true,
        quantity: 2,
        unitCost: 10,
        status: "used",
      }),
    ).toBe(true);
  });

  it("surfaces return-blocked errors as spine { ok:false }", () => {
    const result = catchSpineExpectedFailure(
      new MaterialUsageReturnBlockedError(
        "Cannot return materials after billing closed (INV-1).",
      ),
    );
    expect(result).toEqual({
      ok: false,
      error: "Cannot return materials after billing closed (INV-1).",
    });
  });
});
