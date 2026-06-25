CREATE TABLE IF NOT EXISTS "SupplierBarcode" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"        TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "barcode"         TEXT NOT NULL,
  "barcodeType"     TEXT NOT NULL DEFAULT 'EAN13',
  "packSize"        INTEGER NOT NULL DEFAULT 1,
  "packUnit"        TEXT NOT NULL DEFAULT 'PCS',
  "isDefault"       BOOLEAN NOT NULL DEFAULT false,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierBarcode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierBarcode_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "SupplierBarcode_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SupplierBarcode_tenant_barcode_key"
  ON "SupplierBarcode"("tenantId", "barcode");
CREATE INDEX IF NOT EXISTS "SupplierBarcode_barcode_idx"
  ON "SupplierBarcode"("barcode");
CREATE INDEX IF NOT EXISTS "SupplierBarcode_itemId_idx"
  ON "SupplierBarcode"("inventoryItemId");

CREATE TABLE IF NOT EXISTS "InventoryBatch" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "batchRef"         TEXT NOT NULL,
  "tenantId"         TEXT NOT NULL,
  "inventoryItemId"  TEXT NOT NULL,
  "supplierId"       TEXT,
  "purchaseOrderId"  TEXT,
  "lotNumber"        TEXT,
  "expiryDate"       TIMESTAMP(3),
  "manufacturerDate" TIMESTAMP(3),
  "gtin"             TEXT,
  "receivedQty"      INTEGER NOT NULL DEFAULT 0,
  "currentQty"       INTEGER NOT NULL DEFAULT 0,
  "reservedQty"      INTEGER NOT NULL DEFAULT 0,
  "unitCost"         DECIMAL(10,2),
  "status"           TEXT NOT NULL DEFAULT 'ACTIVE',
  "recalledAt"       TIMESTAMP(3),
  "recallReason"     TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InventoryBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InventoryBatch_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "InventoryBatch_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryBatch_batchRef_key"
  ON "InventoryBatch"("batchRef") WHERE "batchRef" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "InventoryBatch_tenantId_idx" ON "InventoryBatch"("tenantId");
CREATE INDEX IF NOT EXISTS "InventoryBatch_itemId_idx" ON "InventoryBatch"("inventoryItemId");
CREATE INDEX IF NOT EXISTS "InventoryBatch_expiryDate_idx" ON "InventoryBatch"("expiryDate");
CREATE INDEX IF NOT EXISTS "InventoryBatch_lotNumber_idx" ON "InventoryBatch"("lotNumber");

CREATE TABLE IF NOT EXISTS "PurchaseOrder" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "poRef"           TEXT,
  "tenantId"        TEXT NOT NULL,
  "supplierId"      TEXT,
  "status"          TEXT NOT NULL DEFAULT 'DRAFT',
  "orderDate"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expectedDate"    TIMESTAMP(3),
  "receivedDate"    TIMESTAMP(3),
  "subtotal"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "tax"             DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total"           DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes"           TEXT,
  "createdById"     TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrder_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_poRef_key"
  ON "PurchaseOrder"("poRef") WHERE "poRef" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "PurchaseOrder_tenantId_idx" ON "PurchaseOrder"("tenantId");

CREATE TABLE IF NOT EXISTS "PurchaseOrderItem" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "purchaseOrderId" TEXT NOT NULL,
  "inventoryItemId" TEXT NOT NULL,
  "orderedQty"      INTEGER NOT NULL DEFAULT 0,
  "receivedQty"     INTEGER NOT NULL DEFAULT 0,
  "unitCost"        DECIMAL(10,2) NOT NULL DEFAULT 0,
  "total"           DECIMAL(10,2) NOT NULL DEFAULT 0,
  "notes"           TEXT,
  CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey"
    FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE,
  CONSTRAINT "PurchaseOrderItem_inventoryItemId_fkey"
    FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE
);

ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "itemRef"           TEXT,
  ADD COLUMN IF NOT EXISTS "gtin"              TEXT,
  ADD COLUMN IF NOT EXISTS "retailPrice"       DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "taxRate"           DECIMAL(5,2) DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "isSellable"        BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "trackByBatch"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "trackByExpiry"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "storageLocation"   TEXT,
  ADD COLUMN IF NOT EXISTS "storageConditions" TEXT,
  ADD COLUMN IF NOT EXISTS "minStockAlert"     INTEGER,
  ADD COLUMN IF NOT EXISTS "maxStock"          INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "InventoryItem_itemRef_key"
  ON "InventoryItem"("itemRef") WHERE "itemRef" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "InventoryItem_gtin_idx"
  ON "InventoryItem"("gtin");

ALTER TABLE "StockTransaction"
  ADD COLUMN IF NOT EXISTS "transactionRef"  TEXT,
  ADD COLUMN IF NOT EXISTS "batchId"         TEXT,
  ADD COLUMN IF NOT EXISTS "appointmentId"   TEXT,
  ADD COLUMN IF NOT EXISTS "chairId"         TEXT,
  ADD COLUMN IF NOT EXISTS "patientId"       TEXT,
  ADD COLUMN IF NOT EXISTS "invoiceId"       TEXT,
  ADD COLUMN IF NOT EXISTS "purchaseOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS "scannedBarcode"  TEXT,
  ADD COLUMN IF NOT EXISTS "scanMethod"      TEXT;

CREATE TABLE IF NOT EXISTS "PosSession" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"     TEXT NOT NULL,
  "branchId"     TEXT,
  "staffId"      TEXT,
  "sessionRef"   TEXT,
  "openedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "closedAt"     TIMESTAMP(3),
  "openingCash"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "closingCash"  DECIMAL(10,2),
  "totalCash"    DECIMAL(10,2),
  "totalCard"    DECIMAL(10,2),
  "totalSales"   DECIMAL(10,2),
  "status"       TEXT NOT NULL DEFAULT 'OPEN',
  "notes"        TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PosSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PosSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PosSession_tenantId_idx" ON "PosSession"("tenantId");

CREATE TABLE IF NOT EXISTS "ChairSetup" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "chairId"     TEXT,
  "staffId"     TEXT,
  "setupDate"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "items"       JSONB NOT NULL DEFAULT '[]',
  "totalCost"   DECIMAL(10,2),
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChairSetup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChairSetup_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChairSetup_tenantId_idx" ON "ChairSetup"("tenantId");
CREATE INDEX IF NOT EXISTS "ChairSetup_setupDate_idx" ON "ChairSetup"("setupDate");
