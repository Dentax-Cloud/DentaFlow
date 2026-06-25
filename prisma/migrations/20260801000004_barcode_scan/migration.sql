CREATE TABLE IF NOT EXISTS "BarcodeScan" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "scannedCode" TEXT NOT NULL,
  "barcodeType" TEXT NOT NULL DEFAULT 'UNKNOWN',
  "scannedById" TEXT,
  "action"      TEXT NOT NULL DEFAULT 'LOOKUP',
  "entityType"  TEXT,
  "entityId"    TEXT,
  "result"      TEXT NOT NULL DEFAULT 'NOT_FOUND',
  "metadata"    JSONB,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BarcodeScan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BarcodeScan_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "BarcodeScan_tenantId_idx" ON "BarcodeScan"("tenantId");
CREATE INDEX IF NOT EXISTS "BarcodeScan_scannedCode_idx" ON "BarcodeScan"("scannedCode");
CREATE INDEX IF NOT EXISTS "BarcodeScan_createdAt_idx" ON "BarcodeScan"("createdAt");
