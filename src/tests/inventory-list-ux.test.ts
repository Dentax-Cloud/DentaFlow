import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("inventory list UX", () => {
  it("wires Scan item to scan-to-search (not receive/issue from the list modal)", () => {
    const src = readFileSync(
      resolve(__dirname, "../app/(dashboard)/inventory/inventory-client.tsx"),
      "utf8",
    );
    expect(src).toContain("Scan to find item");
    expect(src).toContain("handleScanToSearch");
    expect(src).toContain("scanSupplierBarcode");
    expect(src).toContain("Show in list");
    expect(src).toContain("Item not found");
    expect(src).not.toContain("receiveStock");
    expect(src).not.toContain("issueStockToProcedure");
    expect(src).toContain('viewMode === "table"');
    expect(src).toContain("Search name, SKU, or category");
    expect(src).toContain("All categories");
  });

  it("item detail distinguishes SKU from GTIN / barcode", () => {
    const src = readFileSync(
      resolve(__dirname, "../app/(dashboard)/inventory/[id]/inventory-item-client.tsx"),
      "utf8",
    );
    expect(src).toContain("GTIN / barcode");
    expect(src).toContain("<dt className=\"font-medium text-foreground/80\">SKU</dt>");
  });
});
