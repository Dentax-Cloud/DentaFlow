ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "tenantCode"     TEXT,
  ADD COLUMN IF NOT EXISTS "countryCode"    TEXT NOT NULL DEFAULT 'AE',
  ADD COLUMN IF NOT EXISTS "globalTenantId" TEXT,
  ADD COLUMN IF NOT EXISTS "city"           TEXT,
  ADD COLUMN IF NOT EXISTS "patientIdDisplayMode" TEXT NOT NULL DEFAULT 'FULL';

CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_tenantCode_key"
  ON "Tenant"("tenantCode") WHERE "tenantCode" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "Tenant_globalTenantId_key"
  ON "Tenant"("globalTenantId") WHERE "globalTenantId" IS NOT NULL;

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "branchCode"         TEXT,
  ADD COLUMN IF NOT EXISTS "cityCode"           TEXT NOT NULL DEFAULT 'OTH',
  ADD COLUMN IF NOT EXISTS "branchSeq"          INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "countryCode"        TEXT NOT NULL DEFAULT 'AE',
  ADD COLUMN IF NOT EXISTS "patientSeqCounter"  INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "Branch_branchCode_key"
  ON "Branch"("branchCode") WHERE "branchCode" IS NOT NULL;
