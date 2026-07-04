import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import type { TrayTemplateItem } from "./types";
import {
  STANDARD_TRAY_INVENTORY,
  STANDARD_TRAY_TEMPLATES,
  type StandardTrayTemplateDef,
} from "./standard-tray-catalog";

export type SeedTrayTemplatesResult = {
  inventoryCreated: number;
  inventorySkipped: number;
  templatesCreated: number;
  templatesSkipped: boolean;
  warnings: string[];
};

async function resolveTemplateItems(
  tenantId: string,
  def: StandardTrayTemplateDef,
  warnings: string[],
): Promise<TrayTemplateItem[]> {
  const resolved: TrayTemplateItem[] = [];

  for (const item of def.items) {
    const inv = await db.inventoryItem.findFirst({
      where: { tenantId, sku: item.sku, deletedAt: null },
      select: { id: true, name: true, unit: true, cost: true },
    });

    if (!inv) {
      warnings.push(`Template "${def.name}": missing inventory SKU ${item.sku}`);
      continue;
    }

    resolved.push({
      inventoryItemId: inv.id,
      itemName: inv.name,
      qty: item.qty,
      unit: inv.unit,
      category: item.category,
      costPrice: inv.cost != null ? Number(inv.cost) : undefined,
    });
  }

  return resolved;
}

/**
 * Upsert standard tray inventory SKUs for a tenant (idempotent by SKU).
 */
export async function seedStandardTrayInventory(tenantId: string): Promise<{
  created: number;
  skipped: number;
}> {
  let created = 0;
  let skipped = 0;

  for (const item of STANDARD_TRAY_INVENTORY) {
    const existing = await db.inventoryItem.findFirst({
      where: { tenantId, sku: item.sku },
      select: { id: true, deletedAt: true },
    });

    if (existing) {
      if (existing.deletedAt) {
        await db.inventoryItem.update({
          where: { id: existing.id },
          data: {
            deletedAt: null,
            name: item.name,
            unit: item.unit,
            category: item.category,
            quantity: item.quantity,
            reorderLevel: item.reorderLevel,
            cost: item.cost,
          },
        });
        created++;
      } else {
        skipped++;
      }
      continue;
    }

    await db.inventoryItem.create({
      data: {
        tenantId,
        sku: item.sku,
        name: item.name,
        unit: item.unit,
        category: item.category,
        quantity: item.quantity,
        reorderLevel: item.reorderLevel,
        cost: item.cost,
        trackByExpiry: false,
      },
    });
    created++;
  }

  return { created, skipped };
}

/**
 * Seed 10 industry-standard tray templates for a tenant.
 * Skips entirely if the tenant already has any templates (preserves custom work).
 */
export async function seedStandardTrayTemplates(
  tenantId: string,
): Promise<SeedTrayTemplatesResult> {
  const warnings: string[] = [];

  const invResult = await seedStandardTrayInventory(tenantId);

  const existingCount = await db.chairTrayTemplate.count({
    where: { tenantId },
  });

  if (existingCount > 0) {
    return {
      inventoryCreated: invResult.created,
      inventorySkipped: invResult.skipped,
      templatesCreated: 0,
      templatesSkipped: true,
      warnings,
    };
  }

  let templatesCreated = 0;

  for (const def of STANDARD_TRAY_TEMPLATES) {
    const items = await resolveTemplateItems(tenantId, def, warnings);
    if (items.length === 0) {
      warnings.push(`Skipped template "${def.name}" — no resolvable inventory items`);
      continue;
    }

    await db.chairTrayTemplate.create({
      data: {
        id: randomUUID(),
        tenantId,
        name: def.name,
        isDefault: def.isDefault ?? false,
        notes: def.notes ?? null,
        items,
      },
    });
    templatesCreated++;
  }

  return {
    inventoryCreated: invResult.created,
    inventorySkipped: invResult.skipped,
    templatesCreated,
    templatesSkipped: false,
    warnings,
  };
}

export async function backfillTrayTemplatesForAllTenants(): Promise<{
  tenantsProcessed: number;
  tenantsSeeded: number;
  tenantsSkipped: number;
  results: Array<{ tenantId: string; slug: string; result: SeedTrayTemplatesResult }>;
}> {
  const tenants = await db.tenant.findMany({
    where: { deletedAt: null },
    select: { id: true, slug: true },
    orderBy: { createdAt: "asc" },
  });

  let tenantsSeeded = 0;
  let tenantsSkipped = 0;
  const results: Array<{ tenantId: string; slug: string; result: SeedTrayTemplatesResult }> =
    [];

  for (const tenant of tenants) {
    const result = await seedStandardTrayTemplates(tenant.id);
    results.push({ tenantId: tenant.id, slug: tenant.slug, result });
    if (result.templatesSkipped) {
      tenantsSkipped++;
    } else if (result.templatesCreated > 0) {
      tenantsSeeded++;
    }
  }

  return {
    tenantsProcessed: tenants.length,
    tenantsSeeded,
    tenantsSkipped,
    results,
  };
}
