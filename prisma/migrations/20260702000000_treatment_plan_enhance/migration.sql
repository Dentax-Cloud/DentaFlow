ALTER TABLE "TreatmentPlan"
  ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "parentPlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "acceptedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "rejectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rejectedReason" TEXT,
  ADD COLUMN IF NOT EXISTS "presentedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "totalEstimate" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "insuranceEstimate" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "patientEstimate" DECIMAL(10,2);

ALTER TABLE "TreatmentItem"
  ADD COLUMN IF NOT EXISTS "visitNumber" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "priority" TEXT NOT NULL DEFAULT 'ELECTIVE',
  ADD COLUMN IF NOT EXISTS "procedureCatalogId" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedDuration" INTEGER,
  ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "completedByStaffId" TEXT,
  ADD COLUMN IF NOT EXISTS "linkedAppointmentId" TEXT,
  ADD COLUMN IF NOT EXISTS "surfaces" TEXT;

CREATE TABLE IF NOT EXISTS "TreatmentPlanShare" (
  "id"          TEXT NOT NULL,
  "planId"      TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "token"       TEXT NOT NULL,
  "expiresAt"   TIMESTAMP(3) NOT NULL,
  "viewedAt"    TIMESTAMP(3),
  "acceptedAt"  TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TreatmentPlanShare_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TreatmentPlanShare_token_key" UNIQUE ("token"),
  CONSTRAINT "TreatmentPlanShare_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE,
  CONSTRAINT "TreatmentPlanShare_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "TreatmentPlanShare_token_idx"
  ON "TreatmentPlanShare"("token");
