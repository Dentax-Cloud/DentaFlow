import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";

export type ProcedureBomLine = {
  id: string;
  inventoryItemId: string;
  itemName: string;
  sku: string;
  unit: string;
  defaultQuantity: number;
  isOptional: boolean;
  unitCost: number | null;
  stockOnHand: number;
};

export async function listProcedureBom(
  tenantId: string,
  procedureCatalogId: string,
): Promise<ProcedureBomLine[]> {
  const rows = await db.procedureBomItem.findMany({
    where: { tenantId, procedureCatalogId },
    include: {
      inventoryItem: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          cost: true,
          quantity: true,
          deletedAt: true,
        },
      },
    },
    orderBy: [{ isOptional: "asc" }, { createdAt: "asc" }],
  });

  return rows
    .filter((r) => !r.inventoryItem.deletedAt)
    .map((r) => {
      const s = serializeDecimal(r as Record<string, unknown>);
      const unitCost =
        r.inventoryItem.cost != null ? Number(r.inventoryItem.cost) : null;
      return {
        id: r.id,
        inventoryItemId: r.inventoryItemId,
        itemName: r.inventoryItem.name,
        sku: r.inventoryItem.sku,
        unit: r.inventoryItem.unit,
        defaultQuantity: Number(s.defaultQuantity),
        isOptional: r.isOptional,
        unitCost,
        stockOnHand: r.inventoryItem.quantity,
      };
    });
}

export async function listProcedureBomByCatalogIds(
  tenantId: string,
  procedureCatalogIds: string[],
): Promise<Record<string, ProcedureBomLine[]>> {
  const unique = [...new Set(procedureCatalogIds.filter(Boolean))];
  const out: Record<string, ProcedureBomLine[]> = {};
  for (const id of unique) out[id] = [];
  if (unique.length === 0) return out;

  const rows = await db.procedureBomItem.findMany({
    where: { tenantId, procedureCatalogId: { in: unique } },
    include: {
      inventoryItem: {
        select: {
          id: true,
          name: true,
          sku: true,
          unit: true,
          cost: true,
          quantity: true,
          deletedAt: true,
        },
      },
    },
    orderBy: [{ isOptional: "asc" }, { createdAt: "asc" }],
  });

  for (const r of rows) {
    if (r.inventoryItem.deletedAt) continue;
    const s = serializeDecimal(r as Record<string, unknown>);
    const unitCost =
      r.inventoryItem.cost != null ? Number(r.inventoryItem.cost) : null;
    const line: ProcedureBomLine = {
      id: r.id,
      inventoryItemId: r.inventoryItemId,
      itemName: r.inventoryItem.name,
      sku: r.inventoryItem.sku,
      unit: r.inventoryItem.unit,
      defaultQuantity: Number(s.defaultQuantity),
      isOptional: r.isOptional,
      unitCost,
      stockOnHand: r.inventoryItem.quantity,
    };
    (out[r.procedureCatalogId] ??= []).push(line);
  }
  return out;
}

export function toBomQuantityDecimal(value: number): Prisma.Decimal {
  if (!(value > 0) || !Number.isFinite(value)) {
    throw new Error("BOM quantity must be a positive number.");
  }
  return new Prisma.Decimal(value);
}

/** Empty-state copy for the spine prep checklist (and admin panel). */
export const BOM_EMPTY_STATE_MESSAGE =
  "No bill of materials configured for this procedure";

/**
 * Pure view-model for the nurse/assistant prep checklist.
 * Display-only — does not deduct inventory.
 */
export function bomPrepChecklist(
  bomLines: Array<{
    id: string;
    itemName: string;
    defaultQuantity: number;
    unit: string;
    isOptional: boolean;
  }> | undefined,
): {
  empty: boolean;
  message: string | null;
  lines: Array<{
    id: string;
    label: string;
    quantityLabel: string;
    requiredLabel: "optional" | "required";
  }>;
} {
  const lines = bomLines ?? [];
  if (lines.length === 0) {
    return { empty: true, message: BOM_EMPTY_STATE_MESSAGE, lines: [] };
  }
  return {
    empty: false,
    message: null,
    lines: lines.map((b) => ({
      id: b.id,
      label: b.itemName,
      quantityLabel: `${b.defaultQuantity} ${b.unit}`,
      requiredLabel: b.isOptional ? "optional" : "required",
    })),
  };
}
