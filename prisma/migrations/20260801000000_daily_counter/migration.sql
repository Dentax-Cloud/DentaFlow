CREATE TABLE IF NOT EXISTS "DailyCounter" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT NOT NULL,
  "date"      TEXT NOT NULL,
  "entity"    TEXT NOT NULL,
  "counter"   INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DailyCounter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyCounter_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DailyCounter_tenant_date_entity_key"
  ON "DailyCounter"("tenantId", "date", "entity");

CREATE INDEX IF NOT EXISTS "DailyCounter_tenantId_idx"
  ON "DailyCounter"("tenantId");
