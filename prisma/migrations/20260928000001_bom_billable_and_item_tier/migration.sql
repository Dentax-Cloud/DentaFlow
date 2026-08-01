-- Billable-vs-bundled BoM flag + item-level default tier for lot/expiry logging.

-- ProcedureBomItem: bundled (non-billable) by default — preserves procedure-only invoice totals
-- when materials are logged from BoM without marking them billable.
ALTER TABLE "ProcedureBomItem" ADD COLUMN IF NOT EXISTS "isBillable" BOOLEAN NOT NULL DEFAULT false;

-- MaterialUsage: default true so existing rows keep billing as before this change.
ALTER TABLE "MaterialUsage" ADD COLUMN IF NOT EXISTS "isBillable" BOOLEAN NOT NULL DEFAULT true;

-- InventoryItem.defaultTier: sensible per-item default (tracked when batch-tracked).
ALTER TABLE "InventoryItem" ADD COLUMN IF NOT EXISTS "defaultTier" TEXT NOT NULL DEFAULT 'consumable';

UPDATE "InventoryItem"
SET "defaultTier" = 'tracked'
WHERE "trackByBatch" = true AND ("defaultTier" IS NULL OR "defaultTier" = 'consumable');
