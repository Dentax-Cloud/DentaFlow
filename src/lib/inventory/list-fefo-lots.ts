import { db } from "@/lib/db";
import {
  NEAR_EXPIRY_DAYS,
  sortLotsFefo,
  toLotSuggestion,
  type InventoryLotSuggestion,
} from "@/lib/inventory/lots";

export { NEAR_EXPIRY_DAYS };

/**
 * Available lots for an inventory item, FEFO-ordered (soonest expiry first).
 * Only ACTIVE batches with currentQty > 0 and a non-empty lot number.
 */
export async function listFefoLotsForItem(params: {
  tenantId: string;
  inventoryItemId: string;
  now?: Date;
}): Promise<InventoryLotSuggestion[]> {
  const batches = await db.inventoryBatch.findMany({
    where: {
      tenantId: params.tenantId,
      inventoryItemId: params.inventoryItemId,
      status: "ACTIVE",
      currentQty: { gt: 0 },
      lotNumber: { not: null },
    },
    select: {
      id: true,
      lotNumber: true,
      expiryDate: true,
      currentQty: true,
    },
  });

  const withLots = batches.filter((b) => Boolean(b.lotNumber?.trim()));
  const sorted = sortLotsFefo(withLots, params.now);
  return sorted
    .map((b) => toLotSuggestion(b, params.now))
    .filter((s): s is InventoryLotSuggestion => s != null);
}
