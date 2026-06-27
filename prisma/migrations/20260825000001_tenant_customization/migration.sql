-- Tenant-added or overridden insurance providers
CREATE TABLE IF NOT EXISTS "TenantInsuranceProvider" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"         TEXT NOT NULL,
  "countryCode"      TEXT NOT NULL DEFAULT 'AE',
  "code"             TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "nameAr"           TEXT,
  "shortName"        TEXT NOT NULL,
  "isCustom"         BOOLEAN NOT NULL DEFAULT true,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "requiresPreAuth"  BOOLEAN NOT NULL DEFAULT true,
  "claimEmail"       TEXT,
  "contactPhone"     TEXT,
  "notes"            TEXT,
  "networkTypes"     JSONB NOT NULL DEFAULT '[]',
  "sortOrder"        INTEGER NOT NULL DEFAULT 0,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantInsuranceProvider_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantInsuranceProvider_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantInsuranceProvider_tenant_code_key"
  ON "TenantInsuranceProvider"("tenantId", "code");
CREATE INDEX IF NOT EXISTS "TenantInsuranceProvider_tenantId_idx"
  ON "TenantInsuranceProvider"("tenantId");

-- Insurance fee schedules (per procedure per insurer per network)
CREATE TABLE IF NOT EXISTS "InsuranceFeeSchedule" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"        TEXT NOT NULL,
  "providerCode"    TEXT NOT NULL,
  "networkType"     TEXT,
  "procedureCode"   TEXT NOT NULL,
  "insurerFee"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "patientFee"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "coPayPercent"    DECIMAL(5,2),
  "notes"           TEXT,
  "effectiveFrom"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "effectiveTo"     TIMESTAMP(3),
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "InsuranceFeeSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "InsuranceFeeSchedule_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "InsuranceFeeSchedule_unique_key"
  ON "InsuranceFeeSchedule"(
    "tenantId", "providerCode", "procedureCode",
    COALESCE("networkType", '')
  );
CREATE INDEX IF NOT EXISTS "InsuranceFeeSchedule_tenantId_idx"
  ON "InsuranceFeeSchedule"("tenantId");

-- Custom patient fields definition
CREATE TABLE IF NOT EXISTS "TenantCustomField" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "entity"      TEXT NOT NULL DEFAULT 'PATIENT',
  "fieldKey"    TEXT NOT NULL,
  "fieldLabel"  TEXT NOT NULL,
  "fieldLabelAr" TEXT,
  "fieldType"   TEXT NOT NULL DEFAULT 'TEXT',
  "isRequired"  BOOLEAN NOT NULL DEFAULT false,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "isPortalVisible" BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "options"     JSONB,
  "validation"  JSONB,
  "helpText"    TEXT,
  "section"     TEXT NOT NULL DEFAULT 'ADDITIONAL',
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantCustomField_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantCustomField_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantCustomField_tenant_entity_key_idx"
  ON "TenantCustomField"("tenantId", "entity", "fieldKey");
CREATE INDEX IF NOT EXISTS "TenantCustomField_tenantId_idx"
  ON "TenantCustomField"("tenantId", "entity");

-- Custom field values for patients
CREATE TABLE IF NOT EXISTS "PatientCustomFieldValue" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT NOT NULL,
  "patientId" TEXT NOT NULL,
  "fieldId"   TEXT NOT NULL,
  "value"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientCustomFieldValue_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PatientCustomFieldValue_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "PatientCustomFieldValue_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE,
  CONSTRAINT "PatientCustomFieldValue_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "TenantCustomField"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "PatientCustomFieldValue_patient_field_key"
  ON "PatientCustomFieldValue"("patientId", "fieldId");
CREATE INDEX IF NOT EXISTS "PatientCustomFieldValue_tenantId_idx"
  ON "PatientCustomFieldValue"("tenantId", "patientId");

-- Membership plans
CREATE TABLE IF NOT EXISTS "MembershipPlan" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"         TEXT NOT NULL,
  "name"             TEXT NOT NULL,
  "description"      TEXT,
  "price"            DECIMAL(10,2) NOT NULL,
  "currency"         TEXT NOT NULL DEFAULT 'AED',
  "duration"         TEXT NOT NULL DEFAULT 'ANNUAL',
  "discountPercent"  DECIMAL(5,2) NOT NULL DEFAULT 0,
  "includedServices" JSONB,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MembershipPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MembershipPlan_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "MembershipPlan_tenantId_idx"
  ON "MembershipPlan"("tenantId");

-- Patient memberships
CREATE TABLE IF NOT EXISTS "PatientMembership" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "patientId"   TEXT NOT NULL,
  "planId"      TEXT NOT NULL,
  "startDate"   TIMESTAMP(3) NOT NULL,
  "endDate"     TIMESTAMP(3) NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'ACTIVE',
  "paidAmount"  DECIMAL(10,2) NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientMembership_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PatientMembership_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "PatientMembership_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE,
  CONSTRAINT "PatientMembership_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "PatientMembership_tenantId_idx"
  ON "PatientMembership"("tenantId", "patientId");

-- Corporate accounts
CREATE TABLE IF NOT EXISTS "CorporateAccount" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"         TEXT NOT NULL,
  "companyName"      TEXT NOT NULL,
  "companyNameAr"    TEXT,
  "contactPerson"    TEXT,
  "contactEmail"     TEXT,
  "contactPhone"     TEXT,
  "billingEmail"     TEXT,
  "discountPercent"  DECIMAL(5,2) NOT NULL DEFAULT 0,
  "insuranceCode"    TEXT,
  "invoicingCycle"   TEXT NOT NULL DEFAULT 'MONTHLY',
  "notes"            TEXT,
  "isActive"         BOOLEAN NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CorporateAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CorporateAccount_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "CorporateAccount_tenantId_idx"
  ON "CorporateAccount"("tenantId");

ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "corporateAccountId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Patient_corporateAccountId_fkey'
  ) THEN
    ALTER TABLE "Patient"
      ADD CONSTRAINT "Patient_corporateAccountId_fkey"
      FOREIGN KEY ("corporateAccountId")
      REFERENCES "CorporateAccount"("id") ON DELETE SET NULL;
  END IF;
END $$;

-- Custom payment methods
CREATE TABLE IF NOT EXISTS "TenantPaymentMethod" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "type"        TEXT NOT NULL DEFAULT 'OTHER',
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "isDefault"   BOOLEAN NOT NULL DEFAULT false,
  "config"      JSONB,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantPaymentMethod_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TenantPaymentMethod_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "TenantPaymentMethod_tenant_name_key"
  ON "TenantPaymentMethod"("tenantId", "name");
CREATE INDEX IF NOT EXISTS "TenantPaymentMethod_tenantId_idx"
  ON "TenantPaymentMethod"("tenantId");

-- Referral network
CREATE TABLE IF NOT EXISTS "ReferralContact" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "type"        TEXT NOT NULL DEFAULT 'SPECIALIST',
  "name"        TEXT NOT NULL,
  "specialty"   TEXT,
  "phone"       TEXT,
  "email"       TEXT,
  "address"     TEXT,
  "notes"       TEXT,
  "isActive"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReferralContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ReferralContact_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ReferralContact_tenantId_idx"
  ON "ReferralContact"("tenantId");
