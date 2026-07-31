import { describe, expect, it } from "vitest";
import { StockTransactionType } from "@prisma/client";
import { STOCK_ADJUSTMENT_REASONS } from "@/lib/inventory/stock-adjustment";
import { NEAR_EXPIRY_DAYS } from "@/lib/inventory/lots";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("store inventory gap-closing", () => {
  it("exposes ADJUSTMENT stock reasons used by the count write path", () => {
    expect(STOCK_ADJUSTMENT_REASONS).toContain("count-correction");
    expect(STOCK_ADJUSTMENT_REASONS).toContain("wastage");
    expect(STOCK_ADJUSTMENT_REASONS).toContain("breakage");
    expect(STOCK_ADJUSTMENT_REASONS).toContain("found-stock");
    expect(StockTransactionType.ADJUSTMENT).toBe("ADJUSTMENT");
  });

  it("stock count client writes via adjustStock (ADJUSTMENT), not addStock/removeStock", () => {
    const src = readFileSync(
      resolve(__dirname, "../app/(dashboard)/inventory/count/stock-count-client.tsx"),
      "utf8",
    );
    expect(src).toContain("adjustStock");
    expect(src).not.toContain("addStock");
    expect(src).not.toContain("removeStock");
  });

  it("reuses the shared near-expiry window for material_expiry alerts", () => {
    expect(NEAR_EXPIRY_DAYS).toBe(30);
    const syncSrc = readFileSync(
      resolve(__dirname, "../lib/inventory/material-expiry-alerts.ts"),
      "utf8",
    );
    expect(syncSrc).toContain('type: "material_expiry"');
    expect(syncSrc).toContain("acknowledgedAt: null");
    expect(syncSrc).toContain("sourceRecordId");
  });
});
