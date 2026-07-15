-- Module 6 Phase 1: Encounter spine (additive).
-- EncounterProcedureLine / EncounterProcedureBundle avoid collision with
-- existing Visit Board ProcedureLine and catalog ProcedureBundle.

-- AlterTable
ALTER TABLE "ClinicalImage" ADD COLUMN IF NOT EXISTS "comparesToId" TEXT;

-- CreateTable
CREATE TABLE IF NOT EXISTS "Encounter" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "treatmentPlanId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'arrival_intake',
    "interruptOutcome" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Encounter_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EncounterProcedureBundle" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncounterProcedureBundle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "EncounterProcedureLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "treatmentItemId" TEXT,
    "procedureBundleId" TEXT,
    "procedureCatalogId" TEXT NOT NULL,
    "toothNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "surfaces" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" TEXT NOT NULL DEFAULT 'planned',
    "plannedVsPerformed" TEXT NOT NULL DEFAULT 'matched',
    "providerId" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EncounterProcedureLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "MaterialUsage" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "procedureLineId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "tier" TEXT NOT NULL DEFAULT 'consumable',
    "lotNumber" TEXT,
    "expiryDate" TIMESTAMP(3),
    "quantity" DECIMAL(12,4) NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "deductedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaterialUsage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "InsuranceVerification" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "eligibilityStatus" TEXT NOT NULL DEFAULT 'pending',
    "coverageLimits" JSONB NOT NULL DEFAULT '{}',
    "preAuthStatus" TEXT NOT NULL DEFAULT 'not_required',
    "estimatedCoverage" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedCopay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "verifiedAt" TIMESTAMP(3),
    "staleAfterMinutes" INTEGER NOT NULL DEFAULT 1440,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InsuranceVerification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ConsentRecord" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "procedureLineId" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'clinical',
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentRecord_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "RiskAssessment" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "asaClass" TEXT,
    "vitalsSnapshot" JSONB NOT NULL DEFAULT '{}',
    "flaggedInteractions" JSONB NOT NULL DEFAULT '[]',
    "clearedByStaffId" TEXT,
    "clearedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RiskAssessment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LabCase" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "procedureLineId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3),
    "returnedAt" TIMESTAMP(3),
    "seatedAt" TIMESTAMP(3),
    "externalLabRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LabCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ClinicalAlert" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sourceRecordId" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedByStaffId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalAlert_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ProviderPresence" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "presentFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "presentTo" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProviderPresence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ClinicalImage_comparesToId_idx" ON "ClinicalImage"("comparesToId");
CREATE INDEX IF NOT EXISTS "Encounter_tenantId_idx" ON "Encounter"("tenantId");
CREATE INDEX IF NOT EXISTS "Encounter_tenantId_patientId_idx" ON "Encounter"("tenantId", "patientId");
CREATE INDEX IF NOT EXISTS "Encounter_tenantId_appointmentId_idx" ON "Encounter"("tenantId", "appointmentId");
CREATE INDEX IF NOT EXISTS "Encounter_tenantId_status_idx" ON "Encounter"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Encounter_tenantId_deletedAt_idx" ON "Encounter"("tenantId", "deletedAt");
CREATE INDEX IF NOT EXISTS "EncounterProcedureBundle_tenantId_encounterId_idx" ON "EncounterProcedureBundle"("tenantId", "encounterId");
CREATE INDEX IF NOT EXISTS "EncounterProcedureLine_tenantId_encounterId_idx" ON "EncounterProcedureLine"("tenantId", "encounterId");
CREATE INDEX IF NOT EXISTS "EncounterProcedureLine_tenantId_status_idx" ON "EncounterProcedureLine"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "EncounterProcedureLine_procedureBundleId_idx" ON "EncounterProcedureLine"("procedureBundleId");
CREATE INDEX IF NOT EXISTS "MaterialUsage_tenantId_procedureLineId_idx" ON "MaterialUsage"("tenantId", "procedureLineId");
CREATE INDEX IF NOT EXISTS "MaterialUsage_tenantId_itemId_idx" ON "MaterialUsage"("tenantId", "itemId");
CREATE INDEX IF NOT EXISTS "InsuranceVerification_tenantId_encounterId_idx" ON "InsuranceVerification"("tenantId", "encounterId");
CREATE INDEX IF NOT EXISTS "ConsentRecord_tenantId_encounterId_idx" ON "ConsentRecord"("tenantId", "encounterId");
CREATE INDEX IF NOT EXISTS "RiskAssessment_tenantId_encounterId_idx" ON "RiskAssessment"("tenantId", "encounterId");
CREATE INDEX IF NOT EXISTS "LabCase_tenantId_procedureLineId_idx" ON "LabCase"("tenantId", "procedureLineId");
CREATE INDEX IF NOT EXISTS "LabCase_tenantId_status_idx" ON "LabCase"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "ClinicalAlert_tenantId_encounterId_idx" ON "ClinicalAlert"("tenantId", "encounterId");
CREATE INDEX IF NOT EXISTS "ClinicalAlert_tenantId_type_idx" ON "ClinicalAlert"("tenantId", "type");
CREATE INDEX IF NOT EXISTS "ProviderPresence_tenantId_encounterId_idx" ON "ProviderPresence"("tenantId", "encounterId");
CREATE INDEX IF NOT EXISTS "ProviderPresence_tenantId_staffId_idx" ON "ProviderPresence"("tenantId", "staffId");

-- AddForeignKey (guarded via DO blocks for re-run safety)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalImage_comparesToId_fkey') THEN
    ALTER TABLE "ClinicalImage" ADD CONSTRAINT "ClinicalImage_comparesToId_fkey" FOREIGN KEY ("comparesToId") REFERENCES "ClinicalImage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Encounter_tenantId_fkey') THEN
    ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Encounter_patientId_fkey') THEN
    ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Encounter_appointmentId_fkey') THEN
    ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Encounter_treatmentPlanId_fkey') THEN
    ALTER TABLE "Encounter" ADD CONSTRAINT "Encounter_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EncounterProcedureBundle_tenantId_fkey') THEN
    ALTER TABLE "EncounterProcedureBundle" ADD CONSTRAINT "EncounterProcedureBundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EncounterProcedureBundle_encounterId_fkey') THEN
    ALTER TABLE "EncounterProcedureBundle" ADD CONSTRAINT "EncounterProcedureBundle_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EncounterProcedureLine_tenantId_fkey') THEN
    ALTER TABLE "EncounterProcedureLine" ADD CONSTRAINT "EncounterProcedureLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EncounterProcedureLine_encounterId_fkey') THEN
    ALTER TABLE "EncounterProcedureLine" ADD CONSTRAINT "EncounterProcedureLine_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EncounterProcedureLine_treatmentItemId_fkey') THEN
    ALTER TABLE "EncounterProcedureLine" ADD CONSTRAINT "EncounterProcedureLine_treatmentItemId_fkey" FOREIGN KEY ("treatmentItemId") REFERENCES "TreatmentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EncounterProcedureLine_procedureBundleId_fkey') THEN
    ALTER TABLE "EncounterProcedureLine" ADD CONSTRAINT "EncounterProcedureLine_procedureBundleId_fkey" FOREIGN KEY ("procedureBundleId") REFERENCES "EncounterProcedureBundle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EncounterProcedureLine_procedureCatalogId_fkey') THEN
    ALTER TABLE "EncounterProcedureLine" ADD CONSTRAINT "EncounterProcedureLine_procedureCatalogId_fkey" FOREIGN KEY ("procedureCatalogId") REFERENCES "ProcedureCatalog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'EncounterProcedureLine_providerId_fkey') THEN
    ALTER TABLE "EncounterProcedureLine" ADD CONSTRAINT "EncounterProcedureLine_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialUsage_tenantId_fkey') THEN
    ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialUsage_procedureLineId_fkey') THEN
    ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_procedureLineId_fkey" FOREIGN KEY ("procedureLineId") REFERENCES "EncounterProcedureLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'MaterialUsage_itemId_fkey') THEN
    ALTER TABLE "MaterialUsage" ADD CONSTRAINT "MaterialUsage_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InsuranceVerification_tenantId_fkey') THEN
    ALTER TABLE "InsuranceVerification" ADD CONSTRAINT "InsuranceVerification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'InsuranceVerification_encounterId_fkey') THEN
    ALTER TABLE "InsuranceVerification" ADD CONSTRAINT "InsuranceVerification_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConsentRecord_tenantId_fkey') THEN
    ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConsentRecord_encounterId_fkey') THEN
    ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ConsentRecord_procedureLineId_fkey') THEN
    ALTER TABLE "ConsentRecord" ADD CONSTRAINT "ConsentRecord_procedureLineId_fkey" FOREIGN KEY ("procedureLineId") REFERENCES "EncounterProcedureLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RiskAssessment_tenantId_fkey') THEN
    ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RiskAssessment_encounterId_fkey') THEN
    ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RiskAssessment_clearedByStaffId_fkey') THEN
    ALTER TABLE "RiskAssessment" ADD CONSTRAINT "RiskAssessment_clearedByStaffId_fkey" FOREIGN KEY ("clearedByStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabCase_tenantId_fkey') THEN
    ALTER TABLE "LabCase" ADD CONSTRAINT "LabCase_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'LabCase_procedureLineId_fkey') THEN
    ALTER TABLE "LabCase" ADD CONSTRAINT "LabCase_procedureLineId_fkey" FOREIGN KEY ("procedureLineId") REFERENCES "EncounterProcedureLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalAlert_tenantId_fkey') THEN
    ALTER TABLE "ClinicalAlert" ADD CONSTRAINT "ClinicalAlert_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalAlert_encounterId_fkey') THEN
    ALTER TABLE "ClinicalAlert" ADD CONSTRAINT "ClinicalAlert_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ClinicalAlert_acknowledgedByStaffId_fkey') THEN
    ALTER TABLE "ClinicalAlert" ADD CONSTRAINT "ClinicalAlert_acknowledgedByStaffId_fkey" FOREIGN KEY ("acknowledgedByStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPresence_tenantId_fkey') THEN
    ALTER TABLE "ProviderPresence" ADD CONSTRAINT "ProviderPresence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPresence_encounterId_fkey') THEN
    ALTER TABLE "ProviderPresence" ADD CONSTRAINT "ProviderPresence_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ProviderPresence_staffId_fkey') THEN
    ALTER TABLE "ProviderPresence" ADD CONSTRAINT "ProviderPresence_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$$;