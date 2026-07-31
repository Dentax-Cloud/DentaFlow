import { NEAR_EXPIRY_DAYS, daysUntilExpiry } from "@/lib/inventory/lots";

export type InventoryListStockFilter = "all" | "low";
export type InventoryListViewMode = "card" | "table";

export type InventoryListSortKey =
  | "name"
  | "sku"
  | "category"
  | "quantity"
  | "reorderLevel"
  | "supplier"
  | "tier"
  | "status";

export type InventoryListSortDir = "asc" | "desc";

export type InventoryListItemLike = {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  quantity: number;
  reorderLevel: number;
  minStockAlert?: number | null;
  defaultTier?: string | null;
  gtin?: string | null;
  expiryDate?: Date | string | null;
  supplier?: { id: string; name: string } | null;
  batches?: Array<{ expiryDate?: Date | string | null }>;
};

export function reorderAt(item: Pick<InventoryListItemLike, "minStockAlert" | "reorderLevel">) {
  return item.minStockAlert ?? item.reorderLevel;
}

export function isLowStock(item: InventoryListItemLike) {
  return item.quantity <= reorderAt(item);
}

export function isExpiringSoon(item: InventoryListItemLike, now: Date = new Date()) {
  if (item.expiryDate) {
    const days = daysUntilExpiry(item.expiryDate, now);
    if (days != null && days >= 0 && days <= NEAR_EXPIRY_DAYS) return true;
  }
  return (item.batches ?? []).some((b) => {
    const days = daysUntilExpiry(b.expiryDate, now);
    return days != null && days >= 0 && days <= NEAR_EXPIRY_DAYS;
  });
}

export function inventoryStatusLabel(item: InventoryListItemLike, now: Date = new Date()) {
  const low = isLowStock(item);
  const expiring = isExpiringSoon(item, now);
  if (low && expiring) return "Low · Expiring";
  if (low) return "Low stock";
  if (expiring) return "Expiring soon";
  return "OK";
}

export function distinctCategories(items: InventoryListItemLike[]): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (item.category?.trim()) set.add(item.category.trim());
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function filterInventoryListItems(
  items: InventoryListItemLike[],
  opts: {
    stockFilter: InventoryListStockFilter;
    category: string | null;
    search: string;
    /** When set, pin the list to this single item (scan-to-search). */
    focusItemId?: string | null;
  },
): InventoryListItemLike[] {
  const q = opts.search.trim().toLowerCase();
  return items.filter((item) => {
    if (opts.focusItemId && item.id !== opts.focusItemId) return false;
    if (opts.stockFilter === "low" && !isLowStock(item)) return false;
    if (opts.category && (item.category ?? "") !== opts.category) return false;
    if (!q) return true;
    const hay = [item.name, item.sku, item.category ?? "", item.gtin ?? ""]
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  });
}

function statusSortRank(item: InventoryListItemLike) {
  const low = isLowStock(item);
  const expiring = isExpiringSoon(item);
  if (low && expiring) return 0;
  if (low) return 1;
  if (expiring) return 2;
  return 3;
}

export function sortInventoryListItems(
  items: InventoryListItemLike[],
  key: InventoryListSortKey,
  dir: InventoryListSortDir,
): InventoryListItemLike[] {
  const mul = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "name":
        cmp = a.name.localeCompare(b.name);
        break;
      case "sku":
        cmp = a.sku.localeCompare(b.sku);
        break;
      case "category":
        cmp = (a.category ?? "").localeCompare(b.category ?? "");
        break;
      case "quantity":
        cmp = a.quantity - b.quantity;
        break;
      case "reorderLevel":
        cmp = reorderAt(a) - reorderAt(b);
        break;
      case "supplier":
        cmp = (a.supplier?.name ?? "").localeCompare(b.supplier?.name ?? "");
        break;
      case "tier":
        cmp = (a.defaultTier ?? "").localeCompare(b.defaultTier ?? "");
        break;
      case "status":
        cmp = statusSortRank(a) - statusSortRank(b);
        break;
      default:
        cmp = 0;
    }
    if (cmp === 0) cmp = a.name.localeCompare(b.name);
    return cmp * mul;
  });
}
