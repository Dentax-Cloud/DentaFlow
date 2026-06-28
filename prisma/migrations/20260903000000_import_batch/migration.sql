CREATE TABLE IF NOT EXISTS "ImportBatch" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"     TEXT NOT NULL,
  "entity"       TEXT NOT NULL DEFAULT 'PATIENT',
  "fileName"     TEXT NOT NULL,
  "fileFormat"   TEXT NOT NULL DEFAULT 'XLSX',
  "totalRows"    INTEGER NOT NULL DEFAULT 0,
  "successRows"  INTEGER NOT NULL DEFAULT 0,
  "warningRows"  INTEGER NOT NULL DEFAULT 0,
  "errorRows"    INTEGER NOT NULL DEFAULT 0,
  "skippedRows"  INTEGER NOT NULL DEFAULT 0,
  "mode"         TEXT NOT NULL DEFAULT 'UPSERT',
  "countryCode"  TEXT NOT NULL DEFAULT 'AE',
  "status"       TEXT NOT NULL DEFAULT 'PENDING',
  "importedById" TEXT,
  "errorReport"  JSONB,
  "rollbackData" JSONB,
  "canRollback"  BOOLEAN NOT NULL DEFAULT true,
  "rolledBackAt" TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt"  TIMESTAMP(3),
  CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ImportBatch_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ImportBatch_tenantId_idx"
  ON "ImportBatch"("tenantId");
CREATE INDEX IF NOT EXISTS "ImportBatch_status_idx"
  ON "ImportBatch"("status");
