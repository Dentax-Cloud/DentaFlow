import { InventoryLocationType, type InventoryLocation, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export const DEFAULT_STORE_LOCATION_NAME = "Central store";

/**
 * Resolve the tenant's default store location, creating it if missing
 * (safe for tenants created before the backfill migration).
 */
export async function getDefaultStoreLocation(
  tenantId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<InventoryLocation> {
  const existing = await client.inventoryLocation.findFirst({
    where: { tenantId, isDefault: true, type: InventoryLocationType.store },
  });
  if (existing) return existing;

  const anyStore = await client.inventoryLocation.findFirst({
    where: { tenantId, type: InventoryLocationType.store },
    orderBy: { createdAt: "asc" },
  });
  if (anyStore) {
    if (!anyStore.isDefault) {
      return client.inventoryLocation.update({
        where: { id: anyStore.id },
        data: { isDefault: true },
      });
    }
    return anyStore;
  }

  return client.inventoryLocation.create({
    data: {
      tenantId,
      type: InventoryLocationType.store,
      name: DEFAULT_STORE_LOCATION_NAME,
      isDefault: true,
    },
  });
}

export async function assertStoreLocationOwned(
  tenantId: string,
  locationId: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<InventoryLocation> {
  const loc = await client.inventoryLocation.findFirst({
    where: { id: locationId, tenantId },
  });
  if (!loc) throw new Error("Inventory location not found.");
  return loc;
}
