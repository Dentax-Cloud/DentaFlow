import { describe, expect, it } from "vitest";
import {
  distinctCategories,
  filterInventoryListItems,
  inventoryStatusLabel,
  sortInventoryListItems,
  type InventoryListItemLike,
} from "@/lib/inventory/inventory-list-filters";

const items: InventoryListItemLike[] = [
  {
    id: "1",
    name: "Alginate Impression Material",
    sku: "TRAY-ALGINATE",
    category: "CONSUMABLE",
    quantity: 10,
    reorderLevel: 3,
    defaultTier: "consumable",
    gtin: "0123456789012",
    supplier: { id: "s1", name: "Dental Supply Co" },
  },
  {
    id: "2",
    name: "Amoxicillin 500mg",
    sku: "TD-AMOX-ington",
    category: "MEDICINE",
    quantity: 2,
    reorderLevel: 10,
    minStockAlert: 5,
    defaultTier: "tracked",
    gtin: null,
    supplier: null,
  },
  {
    id: "3",
    name: "Bone Graft Material",
    sku: "TRAY-BONE-GRAFT",
    category: "MATERIAL",
    quantity: 4,
    reorderLevel: 1,
    defaultTier: "tracked",
    expiryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

describe("inventory list filters", () => {
  it("lists distinct categories from real values", () => {
    expect(distinctCategories(items)).toEqual(["CONSUMABLE", "MATERIAL", "MEDICINE"]);
  });

  it("filters by category and search (name/sku)", () => {
    expect(
      filterInventoryListItems(items, {
        stockFilter: "all",
        category: "MEDICINE",
        search: "",
      }).map((i) => i.id),
    ).toEqual(["2"]);

    expect(
      filterInventoryListItems(items, {
        stockFilter: "all",
        category: null,
        search: "alginate",
      }).map((i) => i.id),
    ).toEqual(["1"]);

    expect(
      filterInventoryListItems(items, {
        stockFilter: "all",
        category: null,
        search: "TD-AMOX",
      }).map((i) => i.id),
    ).toEqual(["2"]);
  });

  it("keeps low-stock filter independent of category/search", () => {
    expect(
      filterInventoryListItems(items, {
        stockFilter: "low",
        category: null,
        search: "",
      }).map((i) => i.id),
    ).toEqual(["2"]);
  });

  it("sorts by quantity and name", () => {
    const byQty = sortInventoryListItems(items, "quantity", "asc").map((i) => i.id);
    expect(byQty).toEqual(["2", "3", "1"]);
    const byName = sortInventoryListItems(items, "name", "desc").map((i) => i.name);
    expect(byName[0]).toBe("Bone Graft Material");
  });

  it("labels low stock and expiring soon", () => {
    expect(inventoryStatusLabel(items[1]!)).toBe("Low stock");
    expect(inventoryStatusLabel(items[2]!)).toBe("Expiring soon");
    expect(inventoryStatusLabel(items[0]!)).toBe("OK");
  });
});
