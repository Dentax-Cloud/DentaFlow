-- Tenant country-aware fields
ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "currency"           TEXT NOT NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS "currencySymbol"     TEXT NOT NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS "taxName"            TEXT NOT NULL DEFAULT 'VAT',
  ADD COLUMN IF NOT EXISTS "taxRate"            DECIMAL(5,2) NOT NULL DEFAULT 5,
  ADD COLUMN IF NOT EXISTS "taxNumber"          TEXT,
  ADD COLUMN IF NOT EXISTS "taxOnDental"        BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "regulatoryBody"     TEXT,
  ADD COLUMN IF NOT EXISTS "toothNumbering"     TEXT NOT NULL DEFAULT 'FDI',
  ADD COLUMN IF NOT EXISTS "defaultLanguage"    TEXT NOT NULL DEFAULT 'en',
  ADD COLUMN IF NOT EXISTS "secondaryLanguage"  TEXT,
  ADD COLUMN IF NOT EXISTS "dateFormat"         TEXT NOT NULL DEFAULT 'DD/MM/YYYY',
  ADD COLUMN IF NOT EXISTS "workingDays"        TEXT NOT NULL DEFAULT 'MON,TUE,WED,THU,FRI',
  ADD COLUMN IF NOT EXISTS "primaryCodeSystem"  TEXT NOT NULL DEFAULT 'ICD10',
  ADD COLUMN IF NOT EXISTS "insuranceMandatory" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "hipaaRequired"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "patientRetentionYrs" INTEGER NOT NULL DEFAULT 10;

-- Patient country-aware fields
ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "countryCode"           TEXT,
  ADD COLUMN IF NOT EXISTS "idDocumentType"        TEXT,
  ADD COLUMN IF NOT EXISTS "idDocumentNumber"      TEXT,
  ADD COLUMN IF NOT EXISTS "idDocumentExpiry"      TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "id2DocumentType"       TEXT,
  ADD COLUMN IF NOT EXISTS "id2DocumentNumber"     TEXT,
  ADD COLUMN IF NOT EXISTS "fatherName"            TEXT,
  ADD COLUMN IF NOT EXISTS "grandfatherName"       TEXT,
  ADD COLUMN IF NOT EXISTS "nationality"           TEXT,
  ADD COLUMN IF NOT EXISTS "maritalStatus"         TEXT,
  ADD COLUMN IF NOT EXISTS "occupation"            TEXT,
  ADD COLUMN IF NOT EXISTS "employer"              TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceProvider"     TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceNetwork"      TEXT,
  ADD COLUMN IF NOT EXISTS "insurancePolicyNo"     TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceMemberId"     TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceExpiry"       TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "insuranceCoPayPercent" DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "regulatoryPatientId"   TEXT,
  ADD COLUMN IF NOT EXISTS "corporateAccountId"    TEXT;

CREATE INDEX IF NOT EXISTS "Patient_idDocumentNumber_idx"
  ON "Patient"("idDocumentNumber");
CREATE INDEX IF NOT EXISTS "Patient_insuranceProvider_idx"
  ON "Patient"("insuranceProvider");

-- Invoice country-aware fields
ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "currency"          TEXT NOT NULL DEFAULT 'AED',
  ADD COLUMN IF NOT EXISTS "taxName"           TEXT,
  ADD COLUMN IF NOT EXISTS "taxRateApplied"    DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "taxNumber"         TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceAmount"   DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "patientAmount"     DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "coPayPercent"      DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS "preAuthCode"       TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceClaimRef" TEXT,
  ADD COLUMN IF NOT EXISTS "providerCode"      TEXT,
  ADD COLUMN IF NOT EXISTS "networkType"       TEXT;
