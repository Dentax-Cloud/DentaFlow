"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { StockTransactionType } from "@prisma/client";
import {
  generatePurchaseOrderRef,
  generateBatchRef,
  generateStockRef,
} from "@/lib/ids/generate-ids";
import { parseGS1, detectBarcodeType } from "@/lib/ids/gs1-parser";
import { serializeDecimal } from "@/lib/utils/serialize";

export async function scanSupplierBarcode(barcode: string) {
  const ctx = await requireTenantContext();

  const barcodeType = detectBarcodeType(barcode);

  let gtin: string | undefined;
  let gs1Data: ReturnType<typeof parseGS1> | undefined;

  if (barcodeType === "GS1_128") {
    gs1Data = parseGS1(barcode);
    gtin = gs1Data.gtin;
  } else if (barcodeType === "EAN13" || barcodeType === "EAN8" || barcodeType === "UPCA") {
    gtin = barcode.trim();
  }

  const supplierBarcode = await db.supplierBarcode.findFirst({
    where: { tenantId: ctx.tenantId, barcode: barcode.trim() },
    include: { item: true },
  });

  const gs1Payload = gs1Data
    ? {
        lotNumber: gs1Data.lotNumber,
        expiryDate: gs1Data.expiryDate?.toISOString(),
        quantity: gs1Data.quantity,
        gtin: gs1Data.gtin,
      }
    : null;

  if (supplierBarcode) {
    return {
      found: true,
      item: serializeDecimal(supplierBarcode.item),
      gs1Data: gs1Payload,
      packSize: supplierBarcode.packSize,
      packUnit: supplierBarcode.packUnit,
      barcodeType,
    };
  }

  if (gtin) {
    const item = await db.inventoryItem.findFirst({
      where: { tenantId: ctx.tenantId, gtin, deletedAt: null },
    });
    if (item) {
      return {
        found: true,
        item: serializeDecimal(item),
        gs1Data: gs1Payload,
        packSize: 1,
        packUnit: item.unit,
        barcodeType,
        needsMapping: true,
      };
    }
  }

  const trimmed = barcode.trim();
  const normalized = trimmed.replace(/-/g, "").toUpperCase();

  const itemByRef = await db.inventoryItem.findFirst({
    where: { tenantId: ctx.tenantId, itemRef: trimmed, deletedAt: null },
  });
  if (itemByRef) {
    return {
      found: true,
      item: serializeDecimal(itemByRef),
      gs1Data: gs1Payload,
      packSize: 1,
      packUnit: itemByRef.unit,
      barcodeType: "INTERNAL",
    };
  }

  if (normalized.length >= 6) {
    const itemsWithRef = await db.inventoryItem.findMany({
      where: { tenantId: ctx.tenantId, itemRef: { not: null }, deletedAt: null },
    });
    const matched = itemsWithRef.find(
      (i) => i.itemRef!.replace(/-/g, "").toUpperCase() === normalized,
    );
    if (matched) {
      return {
        found: true,
        item: serializeDecimal(matched),
        gs1Data: gs1Payload,
        packSize: 1,
        packUnit: matched.unit,
        barcodeType: "INTERNAL",
      };
    }
  }

  return {
    found: false,
    barcode,
    barcodeType,
    gs1Data: gs1Payload,
    suggestCreate: true,
  };
}

export async function linkSupplierBarcode(input: {
  inventoryItemId: string;
  barcode: string;
  barcodeType: string;
  packSize?: number;
  packUnit?: string;
  isDefault?: boolean;
}) {
  const ctx = await requireTenantContext();

  const item = await db.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!item) throw new Error("Item not found");

  await db.supplierBarcode.upsert({
    where: {
      tenantId_barcode: {
        tenantId: ctx.tenantId,
        barcode: input.barcode,
      },
    },
    create: {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      inventoryItemId: input.inventoryItemId,
      barcode: input.barcode,
      barcodeType: input.barcodeType,
      packSize: input.packSize ?? 1,
      packUnit: input.packUnit ?? item.unit,
      isDefault: input.isDefault ?? false,
    },
    update: {
      packSize: input.packSize ?? 1,
      packUnit: input.packUnit ?? item.unit,
      isDefault: input.isDefault ?? false,
    },
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${input.inventoryItemId}`);
}

export async function receiveStock(input: {
  inventoryItemId: string;
  quantity: number;
  unitCost?: number;
  supplierId?: string;
  purchaseOrderId?: string;
  lotNumber?: string;
  expiryDate?: string;
  gtin?: string;
  scannedBarcode?: string;
  notes?: string;
}) {
  const ctx = await requireTenantContext();

  const item = await db.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!item) throw new Error("Item not found");

  const transactionRef = await generateStockRef(ctx.tenantId);
  const expiryDate = input.expiryDate ? new Date(input.expiryDate) : null;

  let batchId: string | null = null;
  if (item.trackByBatch || input.lotNumber || expiryDate) {
    const batchRef = generateBatchRef(item.itemRef ?? item.id, expiryDate, input.lotNumber);

    const batch = await db.inventoryBatch.create({
      data: {
        id: randomUUID(),
        batchRef,
        tenantId: ctx.tenantId,
        inventoryItemId: input.inventoryItemId,
        supplierId: input.supplierId ?? null,
        purchaseOrderId: input.purchaseOrderId ?? null,
        lotNumber: input.lotNumber ?? null,
        expiryDate,
        gtin: input.gtin ?? null,
        receivedQty: input.quantity,
        currentQty: input.quantity,
        unitCost: input.unitCost ?? null,
        status: "ACTIVE",
      },
    });
    batchId = batch.id;
  }

  await db.inventoryItem.update({
    where: { id: input.inventoryItemId },
    data: { quantity: { increment: input.quantity } },
  });

  await db.stockTransaction.create({
    data: {
      tenantId: ctx.tenantId,
      itemId: input.inventoryItemId,
      type: StockTransactionType.PURCHASE,
      quantity: input.quantity,
      notes: input.notes ?? null,
      transactionRef,
      batchId,
      purchaseOrderId: input.purchaseOrderId ?? null,
      scannedBarcode: input.scannedBarcode ?? null,
      scanMethod: input.scannedBarcode ? "SUPPLIER_BARCODE" : "MANUAL",
    },
  });

  revalidatePath("/inventory");
  return { transactionRef, batchId };
}

export async function issueStockToProcedure(input: {
  inventoryItemId: string;
  quantity: number;
  appointmentId?: string;
  chairId?: string;
  patientId?: string;
  batchId?: string;
  scannedBarcode?: string;
  notes?: string;
}) {
  const ctx = await requireTenantContext();

  const item = await db.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, tenantId: ctx.tenantId, deletedAt: null },
    select: { id: true, quantity: true, name: true, itemRef: true },
  });
  if (!item) throw new Error("Item not found");
  if (item.quantity < input.quantity) {
    throw new Error(`Insufficient stock: ${item.quantity} available`);
  }

  const transactionRef = await generateStockRef(ctx.tenantId);

  if (input.batchId) {
    const batch = await db.inventoryBatch.findFirst({
      where: { id: input.batchId, tenantId: ctx.tenantId },
    });
    if (!batch || batch.currentQty < input.quantity) {
      throw new Error("Insufficient batch quantity");
    }
    await db.inventoryBatch.update({
      where: { id: input.batchId },
      data: { currentQty: { decrement: input.quantity } },
    });
  } else {
    const batches = await db.inventoryBatch.findMany({
      where: {
        inventoryItemId: input.inventoryItemId,
        tenantId: ctx.tenantId,
        status: "ACTIVE",
        currentQty: { gt: 0 },
      },
      orderBy: { createdAt: "asc" },
    });

    let remaining = input.quantity;
    for (const batch of batches) {
      if (remaining <= 0) break;
      const deduct = Math.min(remaining, batch.currentQty);
      await db.inventoryBatch.update({
        where: { id: batch.id },
        data: { currentQty: { decrement: deduct } },
      });
      remaining -= deduct;
    }
  }

  await db.inventoryItem.update({
    where: { id: input.inventoryItemId },
    data: { quantity: { decrement: input.quantity } },
  });

  await db.stockTransaction.create({
    data: {
      tenantId: ctx.tenantId,
      itemId: input.inventoryItemId,
      type: StockTransactionType.USAGE,
      quantity: input.quantity,
      notes: input.notes ?? null,
      transactionRef,
      batchId: input.batchId ?? null,
      appointmentId: input.appointmentId ?? null,
      chairId: input.chairId ?? null,
      patientId: input.patientId ?? null,
      scannedBarcode: input.scannedBarcode ?? null,
      scanMethod: input.scannedBarcode ? "INTERNAL_LABEL" : "MANUAL",
    },
  });

  revalidatePath("/inventory");
  return { transactionRef };
}

export async function posItemSale(input: {
  inventoryItemId: string;
  quantity: number;
  patientId?: string;
  invoiceId?: string;
  scannedBarcode?: string;
}) {
  const ctx = await requireTenantContext();

  const item = await db.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, tenantId: ctx.tenantId, deletedAt: null },
    select: {
      id: true,
      name: true,
      quantity: true,
      retailPrice: true,
      taxRate: true,
      isSellable: true,
      itemRef: true,
    },
  });

  if (!item) throw new Error("Item not found");
  if (!item.isSellable) throw new Error("Item is not for retail sale");
  if (item.quantity < input.quantity) {
    throw new Error(`Only ${item.quantity} in stock`);
  }

  const transactionRef = await generateStockRef(ctx.tenantId);

  await db.inventoryItem.update({
    where: { id: input.inventoryItemId },
    data: { quantity: { decrement: input.quantity } },
  });

  await db.stockTransaction.create({
    data: {
      tenantId: ctx.tenantId,
      itemId: input.inventoryItemId,
      type: StockTransactionType.USAGE,
      quantity: input.quantity,
      notes: "POS sale",
      transactionRef,
      patientId: input.patientId ?? null,
      invoiceId: input.invoiceId ?? null,
      scannedBarcode: input.scannedBarcode ?? null,
      scanMethod: "SUPPLIER_BARCODE",
    },
  });

  return {
    transactionRef,
    unitPrice: Number(item.retailPrice ?? 0),
    taxRate: Number(item.taxRate ?? 5),
    lineTotal: Number(item.retailPrice ?? 0) * input.quantity,
  };
}

export async function createPurchaseOrder(input: {
  supplierId?: string;
  expectedDate?: string;
  notes?: string;
  items: Array<{
    inventoryItemId: string;
    orderedQty: number;
    unitCost: number;
  }>;
}) {
  const ctx = await requireTenantContext();

  const poRef = await generatePurchaseOrderRef(ctx.tenantId);

  const subtotal = input.items.reduce((sum, i) => sum + i.orderedQty * i.unitCost, 0);

  const po = await db.purchaseOrder.create({
    data: {
      id: randomUUID(),
      poRef,
      tenantId: ctx.tenantId,
      supplierId: input.supplierId ?? null,
      expectedDate: input.expectedDate ? new Date(input.expectedDate) : null,
      notes: input.notes ?? null,
      subtotal,
      tax: subtotal * 0.05,
      total: subtotal * 1.05,
      status: "ORDERED",
      createdById: ctx.staffMember?.id ?? null,
      items: {
        create: input.items.map((i) => ({
          id: randomUUID(),
          inventoryItemId: i.inventoryItemId,
          orderedQty: i.orderedQty,
          receivedQty: 0,
          unitCost: i.unitCost,
          total: i.orderedQty * i.unitCost,
        })),
      },
    },
    include: { items: true },
  });

  revalidatePath("/inventory/purchase-orders");
  return serializeDecimal(po);
}

export async function getExpiryAlerts(daysAhead = 30) {
  const ctx = await requireTenantContext();

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + daysAhead);

  const batches = await db.inventoryBatch.findMany({
    where: {
      tenantId: ctx.tenantId,
      expiryDate: { lte: cutoff },
      status: "ACTIVE",
      currentQty: { gt: 0 },
    },
    include: {
      item: { select: { name: true, unit: true } },
    },
    orderBy: { expiryDate: "asc" },
  });

  return batches.map((b) => serializeDecimal(b));
}

export async function updateInventoryRetailGst(input: {
  inventoryItemId: string;
  retailPrice?: number | null;
  taxRate?: number | null;
  hsnCode?: string | null;
  isSellable?: boolean;
}) {
  const ctx = await requireTenantContext();

  const item = await db.inventoryItem.findFirst({
    where: { id: input.inventoryItemId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!item) throw new Error("Inventory item not found");

  await db.inventoryItem.update({
    where: { id: input.inventoryItemId },
    data: {
      ...(input.retailPrice !== undefined ? { retailPrice: input.retailPrice } : {}),
      ...(input.taxRate !== undefined ? { taxRate: input.taxRate } : {}),
      ...(input.hsnCode !== undefined ? { hsnCode: input.hsnCode?.trim() || null } : {}),
      ...(input.isSellable !== undefined ? { isSellable: input.isSellable } : {}),
    },
  });

  revalidatePath("/inventory");
  revalidatePath(`/inventory/${input.inventoryItemId}`);
  return { ok: true };
}

export async function initiateRecall(input: {
  lotNumber?: string;
  gtin?: string;
  reason: string;
}) {
  const ctx = await requireTenantContext();

  const batches = await db.inventoryBatch.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(input.lotNumber ? { lotNumber: input.lotNumber } : {}),
      ...(input.gtin ? { gtin: input.gtin } : {}),
      status: "ACTIVE",
    },
    include: { item: true },
  });

  const batchIds = batches.map((b) => b.id);
  const transactions = await db.stockTransaction.findMany({
    where: {
      tenantId: ctx.tenantId,
      batchId: { in: batchIds },
      patientId: { not: null },
    },
    select: { patientId: true },
  });

  const affectedPatientIds = [...new Set(transactions.map((t) => t.patientId).filter(Boolean))];

  await db.inventoryBatch.updateMany({
    where: { id: { in: batchIds } },
    data: {
      status: "RECALLED",
      recalledAt: new Date(),
      recallReason: input.reason,
    },
  });

  return {
    batchesRecalled: batches.length,
    affectedPatients: affectedPatientIds.length,
    affectedPatientIds,
    itemsAffected: [...new Set(batches.map((b) => b.item.name))],
  };
}

export async function disposeExpiredBatch(batchId: string, notes?: string) {
  const ctx = await requireTenantContext();

  const batch = await db.inventoryBatch.findFirst({
    where: { id: batchId, tenantId: ctx.tenantId },
    include: { item: true },
  });
  if (!batch || batch.currentQty <= 0) throw new Error("Batch not found or empty");

  const qty = batch.currentQty;
  const transactionRef = await generateStockRef(ctx.tenantId);

  await db.inventoryBatch.update({
    where: { id: batchId },
    data: { currentQty: 0, status: "EXPIRED" },
  });

  await db.inventoryItem.update({
    where: { id: batch.inventoryItemId },
    data: { quantity: { decrement: qty } },
  });

  await db.stockTransaction.create({
    data: {
      tenantId: ctx.tenantId,
      itemId: batch.inventoryItemId,
      type: StockTransactionType.EXPIRED,
      quantity: qty,
      notes: notes ?? "Expired batch disposal",
      transactionRef,
      batchId,
    },
  });

  revalidatePath("/inventory/expiry");
  return { transactionRef };
}
