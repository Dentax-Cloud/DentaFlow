-- MaterialUsage return-to-store: keep the original row, mark returned, reverse stock separately.
ALTER TABLE "MaterialUsage" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'used';
ALTER TABLE "MaterialUsage" ADD COLUMN IF NOT EXISTS "returnedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "MaterialUsage_tenantId_status_idx"
  ON "MaterialUsage"("tenantId", "status");
