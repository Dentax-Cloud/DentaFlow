-- InventoryLocation + ProcedureBomItem + location refs on stock movements / material usage

CREATE TYPE "InventoryLocationType" AS ENUM ('store', 'chair');

CREATE TABLE "InventoryLocation" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "InventoryLocationType" NOT NULL DEFAULT 'store',
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryLocation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InventoryLocation_tenantId_idx" ON "InventoryLocation"("tenantId");
CREATE INDEX "InventoryLocation_tenantId_type_idx" ON "InventoryLocation"("tenantId", "type");
CREATE INDEX "InventoryLocation_tenantId_isDefault_idx" ON "InventoryLocation"("tenantId", "isDefault");

-- At most one default location per tenant
CREATE UNIQUE INDEX "InventoryLocation_tenantId_default_uidx"
  ON "InventoryLocation"("tenantId")
  WHERE "isDefault" = true;

ALTER TABLE "InventoryLocation"
  ADD CONSTRAINT "InventoryLocation_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill one default store location per existing tenant
INSERT INTO "InventoryLocation" ("id", "tenantId", "type", "name", "isDefault", "createdAt", "updatedAt")
SELECT
  'iloc_' || t."id",
  t."id",
  'store'::"InventoryLocationType",
  'Central store',
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Tenant" t
WHERE NOT EXISTS (
  SELECT 1 FROM "InventoryLocation" il WHERE il."tenantId" = t."id"
);

CREATE TABLE "ProcedureBomItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "procedureCatalogId" TEXT NOT NULL,
    "inventoryItemId" TEXT NOT NULL,
    "defaultQuantity" DECIMAL(12,4) NOT NULL,
    "isOptional" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureBomItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProcedureBomItem_procedureCatalogId_inventoryItemId_key"
  ON "ProcedureBomItem"("procedureCatalogId", "inventoryItemId");
CREATE INDEX "ProcedureBomItem_tenantId_idx" ON "ProcedureBomItem"("tenantId");
CREATE INDEX "ProcedureBomItem_tenantId_procedureCatalogId_idx"
  ON "ProcedureBomItem"("tenantId", "procedureCatalogId");

ALTER TABLE "ProcedureBomItem"
  ADD CONSTRAINT "ProcedureBomItem_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcedureBomItem"
  ADD CONSTRAINT "ProcedureBomItem_procedureCatalogId_fkey"
  FOREIGN KEY ("procedureCatalogId") REFERENCES "ProcedureCatalog"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ProcedureBomItem"
  ADD CONSTRAINT "ProcedureBomItem_inventoryItemId_fkey"
  FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StockTransaction" ADD COLUMN "locationId" TEXT;
CREATE INDEX "StockTransaction_tenantId_locationId_idx" ON "StockTransaction"("tenantId", "locationId");
ALTER TABLE "StockTransaction"
  ADD CONSTRAINT "StockTransaction_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Point historical stock movements at the tenant default store (behavior unchanged)
UPDATE "StockTransaction" st
SET "locationId" = il."id"
FROM "InventoryLocation" il
WHERE il."tenantId" = st."tenantId"
  AND il."isDefault" = true
  AND st."locationId" IS NULL;

ALTER TABLE "MaterialUsage" ADD COLUMN "locationId" TEXT;
CREATE INDEX "MaterialUsage_tenantId_locationId_idx" ON "MaterialUsage"("tenantId", "locationId");
ALTER TABLE "MaterialUsage"
  ADD CONSTRAINT "MaterialUsage_locationId_fkey"
  FOREIGN KEY ("locationId") REFERENCES "InventoryLocation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "MaterialUsage" mu
SET "locationId" = il."id"
FROM "InventoryLocation" il
WHERE il."tenantId" = mu."tenantId"
  AND il."isDefault" = true
  AND mu."locationId" IS NULL;
