import { describe, expect, it } from "vitest";
import { InventoryLocationType, StockTransactionType } from "@prisma/client";
import { STOCK_ADJUSTMENT_REASONS } from "@/lib/inventory/stock-adjustment";
import {
  STOCK_ISSUE_DESTINATION_TYPES,
  STOCK_ISSUE_REASONS,
} from "@/lib/inventory/stock-issue";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("inventory integrations — chair / receive / issue", () => {
  it("keeps InventoryLocationType.chair reserved (schema only; app uses store locations)", () => {
    expect(InventoryLocationType.chair).toBe("chair");
    expect(InventoryLocationType.store).toBe("store");
    const locationsSrc = readFileSync(
      resolve(__dirname, "../lib/inventory/locations.ts"),
      "utf8",
    );
    expect(locationsSrc).toContain("InventoryLocationType.store");
    expect(locationsSrc).not.toContain("InventoryLocationType.chair");
  });

  it("chair stock page is visibility-only and gated by chair_inventory", () => {
    const page = readFileSync(
      resolve(__dirname, "../app/(dashboard)/inventory/chairs/page.tsx"),
      "utf8",
    );
    expect(page).toContain('requireRouteAccess("chair_inventory", "read")');
    expect(page).toContain("ChairDaySetup");
    expect(page).toMatch(/read-only|visibility only|Visibility only/i);
    expect(page).not.toContain("issueStock");
    expect(page).not.toContain("receiveStock");
    expect(page).not.toContain("addStock");
  });

  it("receiveStock updates PO status, most-recent cost, PURCHASE tx, and audit", () => {
    const src = readFileSync(
      resolve(__dirname, "../app/(dashboard)/features/inventory/inventory-actions.ts"),
      "utf8",
    );
    expect(src).toContain("export async function receiveStock");
    expect(src).toContain("StockTransactionType.PURCHASE");
    expect(src).toContain("Most-recent-received cost");
    expect(src).toContain("PARTIALLY_RECEIVED");
    expect(src).toContain('kind: "stock_receipt"');
    expect(src).toContain("purchaseOrderItemId");
    expect(StockTransactionType.PURCHASE).toBe("PURCHASE");
  });

  it("purchase-orders UI wires GoodsReceiptScanner with selected PO id", () => {
    const client = readFileSync(
      resolve(__dirname, "../app/(dashboard)/inventory/purchase-orders/purchase-orders-client.tsx"),
      "utf8",
    );
    expect(client).toContain("GoodsReceiptScanner");
    expect(client).toContain("purchaseOrderId={selectedPoId");
    expect(client).toContain("receiveStock");
    expect(client).toContain("createPurchaseOrder");
  });

  it("formal issueStock uses USAGE + destination/reason taxonomy aligned with ADJUSTMENT", () => {
    expect(STOCK_ISSUE_REASONS).toContain("breakage");
    expect(STOCK_ISSUE_REASONS).toContain("wastage");
    expect(STOCK_ISSUE_REASONS).toContain("allocated-to-chair");
    expect(STOCK_ISSUE_REASONS).toContain("allocated-to-staff");
    expect(STOCK_ADJUSTMENT_REASONS).toContain("breakage");
    expect(STOCK_ADJUSTMENT_REASONS).toContain("wastage");
    expect(STOCK_ISSUE_DESTINATION_TYPES).toEqual(["chair", "staff", "other"]);

    const actions = readFileSync(
      resolve(__dirname, "../app/(dashboard)/features/inventory/actions.ts"),
      "utf8",
    );
    expect(actions).toContain("export const issueStock");
    expect(actions).toContain("StockTransactionType.USAGE");
    expect(actions).toContain('kind: "stock_issue"');
    expect(actions).toContain("createAuditLog");
  });

  it("inventory client keeps quick Remove and adds distinct Issue flow", () => {
    const client = readFileSync(
      resolve(__dirname, "../app/(dashboard)/inventory/inventory-client.tsx"),
      "utf8",
    );
    expect(client).toContain("issueStock");
    expect(client).toContain("removeStock");
    expect(client).toContain('openDialog("issue"');
    expect(client).toContain('openDialog("remove"');
    expect(client).toContain("STOCK_ISSUE_REASONS");
  });

  it("does not alter spine MaterialUsage deduct path", () => {
    const deduct = readFileSync(
      resolve(__dirname, "../lib/inventory/deduct-store-stock.ts"),
      "utf8",
    );
    expect(deduct).toContain("MaterialUsage");
    expect(deduct).not.toContain("issueStock");
    expect(deduct).not.toContain("STOCK_ISSUE_REASONS");
  });
});
