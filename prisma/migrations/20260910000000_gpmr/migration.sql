-- ============================================================
-- Sprint 3: Global Procedure Engine
-- Migration: 20260910000000_gpmr
-- IMPORTANT: No price fields in GlobalProcedure or 
--            CountryProcedurePack — tenant admin sets all prices
-- ============================================================

-- Global Procedure Master Registry
CREATE TABLE IF NOT EXISTS "GlobalProcedure" (
  "id"                   TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "gpmrCode"             TEXT NOT NULL,
  "canonicalName"        TEXT NOT NULL,
  "names"                JSONB NOT NULL DEFAULT '{}',
  "category"             TEXT NOT NULL,
  "subCategory"          TEXT,
  "clinicalDescription"  TEXT,
  "defaultDurationMins"  INTEGER NOT NULL DEFAULT 30,
  "toothRequired"        BOOLEAN NOT NULL DEFAULT false,
  "surfaceRequired"      BOOLEAN NOT NULL DEFAULT false,
  "archRequired"         BOOLEAN NOT NULL DEFAULT false,
  "quadrantRequired"     BOOLEAN NOT NULL DEFAULT false,
  "requiredInputs"       JSONB NOT NULL DEFAULT '[]',
  "optionalInputs"       JSONB NOT NULL DEFAULT '[]',
  "prerequisites"        JSONB NOT NULL DEFAULT '[]',
  "contraindications"    JSONB NOT NULL DEFAULT '[]',
  "postProcedureActions" JSONB NOT NULL DEFAULT '[]',
  "requiredAttachments"  JSONB NOT NULL DEFAULT '[]',
  "optionalAttachments"  JSONB NOT NULL DEFAULT '[]',
  "globalCodes"          JSONB NOT NULL DEFAULT '{}',
  "modules"              JSONB NOT NULL DEFAULT '[]',
  "isBillable"           BOOLEAN NOT NULL DEFAULT true,
  "canBundle"            BOOLEAN NOT NULL DEFAULT true,
  "aiSuggestTriggers"    JSONB NOT NULL DEFAULT '[]',
  "isActive"             BOOLEAN NOT NULL DEFAULT true,
  "version"              TEXT NOT NULL DEFAULT '1.0.0',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GlobalProcedure_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GlobalProcedure_gpmrCode_key" UNIQUE ("gpmrCode")
);

CREATE INDEX IF NOT EXISTS "GlobalProcedure_category_idx"
  ON "GlobalProcedure"("category");
CREATE INDEX IF NOT EXISTS "GlobalProcedure_isActive_idx"
  ON "GlobalProcedure"("isActive");

-- Country-specific procedure overlay
-- NO price fields — only codes and compliance rules
CREATE TABLE IF NOT EXISTS "CountryProcedurePack" (
  "id"                TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "gpmrId"            TEXT NOT NULL,
  "countryCode"       TEXT NOT NULL,
  "packVersion"       TEXT NOT NULL DEFAULT '1.0.0',
  "localName"         TEXT,
  "localNameAr"       TEXT,
  "localNames"        JSONB NOT NULL DEFAULT '{}',
  "localCodes"        JSONB NOT NULL DEFAULT '{}',
  "taxRules"          JSONB NOT NULL DEFAULT '{}',
  "insuranceCodes"    JSONB NOT NULL DEFAULT '{}',
  "complianceRules"   JSONB NOT NULL DEFAULT '{}',
  "workflowAdditions" JSONB NOT NULL DEFAULT '{}',
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "effectiveFrom"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo"       TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CountryProcedurePack_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CountryProcedurePack_gpmrId_fkey"
    FOREIGN KEY ("gpmrId") REFERENCES "GlobalProcedure"("id")
    ON DELETE CASCADE,
  CONSTRAINT "CountryProcedurePack_gpmrId_country_key"
    UNIQUE ("gpmrId", "countryCode")
);

CREATE INDEX IF NOT EXISTS "CountryProcedurePack_countryCode_idx"
  ON "CountryProcedurePack"("countryCode");
CREATE INDEX IF NOT EXISTS "CountryProcedurePack_gpmrId_idx"
  ON "CountryProcedurePack"("gpmrId");

-- Procedure bundles (tenant-created, tenant-priced)
CREATE TABLE IF NOT EXISTS "ProcedureBundle" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"         TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "description"      TEXT,
  "bundlePrice"      DECIMAL(10,2),
  "currency"         TEXT NOT NULL DEFAULT 'AED',
  "durationMins"     INTEGER NOT NULL DEFAULT 60,
  "items"            JSONB NOT NULL DEFAULT '[]',
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "isOnlineBookable" BOOLEAN NOT NULL DEFAULT false,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ProcedureBundle_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ProcedureBundle_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ProcedureBundle_tenantId_idx"
  ON "ProcedureBundle"("tenantId");

-- Clinical compliance records
CREATE TABLE IF NOT EXISTS "ClinicalComplianceRecord" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "patientId"     TEXT NOT NULL,
  "appointmentId" TEXT,
  "gpmrId"        TEXT,
  "procedureCode" TEXT,
  "localCode"     TEXT,
  "countryPack"   TEXT,
  "performedById" TEXT NOT NULL,
  "licenseNumber" TEXT,
  "performedAt"   TIMESTAMP(3) NOT NULL,
  "toothNumbers"  JSONB NOT NULL DEFAULT '[]',
  "surfaces"      JSONB NOT NULL DEFAULT '[]',
  "checklist"     JSONB NOT NULL DEFAULT '{}',
  "billedAmount"  DECIMAL(10,2),
  "insurerAmount" DECIMAL(10,2),
  "patientAmount" DECIMAL(10,2),
  "currencyCode"  TEXT NOT NULL DEFAULT 'AED',
  "preAuthCode"   TEXT,
  "claimCode"     TEXT,
  "claimSubmitted" BOOLEAN NOT NULL DEFAULT false,
  "auditHash"     TEXT,
  "signedByDoctor" BOOLEAN NOT NULL DEFAULT false,
  "signedAt"      TIMESTAMP(3),
  "regulatoryRef" TEXT,
  "complianceStd" TEXT,
  "retentionUntil" TIMESTAMP(3),
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicalComplianceRecord_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClinicalComplianceRecord_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClinicalComplianceRecord_tenant_patient_idx"
  ON "ClinicalComplianceRecord"("tenantId", "patientId");
CREATE INDEX IF NOT EXISTS "ClinicalComplianceRecord_performedAt_idx"
  ON "ClinicalComplianceRecord"("performedAt");

-- Add new columns to existing ProcedureCatalog (non-breaking)
ALTER TABLE "ProcedureCatalog"
  ADD COLUMN IF NOT EXISTS "gpmrId"           TEXT,
  ADD COLUMN IF NOT EXISTS "nameAr"           TEXT,
  ADD COLUMN IF NOT EXISTS "branchPrices"     JSONB,
  ADD COLUMN IF NOT EXISTS "requiresConsent"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requiresXray"     BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "requiresPreAuth"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "workflowConfig"   JSONB,
  ADD COLUMN IF NOT EXISTS "isOnlineBookable" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sortOrder"        INTEGER NOT NULL DEFAULT 0;

-- Add FK for gpmrId (nullable — non-breaking)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ProcedureCatalog_gpmrId_fkey'
  ) THEN
    ALTER TABLE "ProcedureCatalog"
      ADD CONSTRAINT "ProcedureCatalog_gpmrId_fkey"
      FOREIGN KEY ("gpmrId") REFERENCES "GlobalProcedure"("id")
      ON DELETE SET NULL;
  END IF;
END $$;