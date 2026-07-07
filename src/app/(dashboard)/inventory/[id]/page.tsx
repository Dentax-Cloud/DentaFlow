export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { serializeDecimal } from "@/lib/utils/serialize";
import { InventoryItemClient } from "./inventory-item-client";

export default async function InventoryItemPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireRouteAccess("inventory", "read");

  const item = await db.inventoryItem.findFirst({
    where: { id, tenantId: ctx.tenant.id, deletedAt: null },
    include: {
      supplierBarcodes: true,
      batches: {
        where: { status: { not: "EMPTY" } },
        orderBy: { expiryDate: "asc" },
      },
      transactions: {
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          batch: { select: { lotNumber: true, expiryDate: true } },
        },
      },
    },
  });

  if (!item) notFound();

  const [tenant, allProcedures] = await Promise.all([
    db.tenant.findUnique({
      where: { id: ctx.tenant.id },
      select: { currency: true, tenantCode: true, countryCode: true },
    }),
    db.procedureCatalog.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      select: {
        id: true,
        code: true,
        name: true,
        category: true,
        inventoryConsumption: true,
      },
    }),
  ]);

  const linkedProcedures = allProcedures
    .map((proc) => {
      if (!proc.inventoryConsumption) return null;
      try {
        const lines = JSON.parse(proc.inventoryConsumption) as {
          inventoryItemId: string;
          quantity: number;
        }[];
        const line = lines.find((l) => l.inventoryItemId === id);
        if (!line) return null;
        return {
          id: proc.id,
          code: proc.code,
          name: proc.name,
          category: proc.category,
          quantityPerProcedure: line.quantity,
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as Array<{
    id: string;
    code: string;
    name: string;
    category: string | null;
    quantityPerProcedure: number;
  }>;

  const serialized = serializeDecimal(item);
  const cost = typeof serialized.cost === "number" ? serialized.cost : 0;
  const retailPrice = typeof serialized.retailPrice === "number" ? serialized.retailPrice : null;
  const totalValue = cost * item.quantity;

  return (
    <InventoryItemClient
      item={{
        id: item.id,
        name: item.name,
        sku: item.sku,
        itemRef: item.itemRef,
        category: item.category,
        unit: item.unit,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        minStockAlert: item.minStockAlert,
        maxStock: item.maxStock,
        cost,
        retailPrice,
        taxRate: typeof serialized.taxRate === "number" ? serialized.taxRate : null,
        hsnCode: item.hsnCode,
        isSellable: item.isSellable,
        storageLocation: item.storageLocation,
        storageConditions: item.storageConditions,
        trackByBatch: item.trackByBatch,
        trackByExpiry: item.trackByExpiry,
        gtin: item.gtin,
        supplierBarcodes: item.supplierBarcodes,
        batches: item.batches.map((b) => {
          const serialized = serializeDecimal(b);
          return {
            id: b.id,
            batchRef: b.batchRef,
            lotNumber: b.lotNumber,
            expiryDate: b.expiryDate?.toISOString() ?? null,
            currentQty: b.currentQty,
            receivedQty: b.receivedQty,
            status: b.status,
            unitCost: typeof serialized.unitCost === "number" ? serialized.unitCost : null,
          };
        }),
        transactions: item.transactions.map((t) => {
          const serialized = serializeDecimal(t);
          return {
            id: t.id,
            type: t.type,
            quantity: t.quantity,
            notes: t.notes,
            transactionRef: t.transactionRef,
            createdAt: t.createdAt.toISOString(),
            batch: t.batch
              ? {
                  lotNumber: t.batch.lotNumber,
                  expiryDate: t.batch.expiryDate?.toISOString() ?? null,
                }
              : null,
          };
        }),
      }}
      currency={tenant?.currency ?? "AED"}
      countryCode={tenant?.countryCode ?? "AE"}
      tenantCode={tenant?.tenantCode ?? ""}
      totalValue={totalValue}
      linkedProcedures={linkedProcedures}
    />
  );
}
