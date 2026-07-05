-- Widen Claim model for Phase 3 insurance claims lifecycle

DO $$ BEGIN
  CREATE TYPE "ClaimFormat" AS ENUM ('MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ClaimDenialCategory" AS ENUM (
    'COVERAGE',
    'AUTHORIZATION',
    'CODING',
    'DOCUMENTATION',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'PARTIALLY_APPROVED';
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'APPEALED';
ALTER TYPE "ClaimStatus" ADD VALUE IF NOT EXISTS 'WRITTEN_OFF';

ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "submittedAmount" DECIMAL(12,2);
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "approvedAmount" DECIMAL(12,2);
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(12,2);
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "paymentVariance" DECIMAL(12,2);
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "claimFormat" "ClaimFormat" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "procedureSnapshot" JSONB;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "decisionAt" TIMESTAMP(3);
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "denialReason" TEXT;
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "denialCategory" "ClaimDenialCategory";
ALTER TABLE "Claim" ADD COLUMN IF NOT EXISTS "appealedClaimId" TEXT;

-- Backfill new required fields from legacy columns where present
UPDATE "Claim"
SET
  "submittedAmount" = COALESCE("submittedAmount", "amount"),
  "procedureSnapshot" = COALESCE("procedureSnapshot", '[]'::jsonb)
WHERE "submittedAmount" IS NULL OR "procedureSnapshot" IS NULL;

ALTER TABLE "Claim" ALTER COLUMN "submittedAmount" SET NOT NULL;
ALTER TABLE "Claim" ALTER COLUMN "procedureSnapshot" SET NOT NULL;
ALTER TABLE "Claim" ALTER COLUMN "procedureSnapshot" SET DEFAULT '[]'::jsonb;

-- invoiceId required for new claims
DELETE FROM "Claim" WHERE "invoiceId" IS NULL;

ALTER TABLE "Claim" ALTER COLUMN "invoiceId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "Claim_tenantId_status_idx" ON "Claim"("tenantId", "status");
CREATE INDEX IF NOT EXISTS "Claim_tenantId_invoiceId_idx" ON "Claim"("tenantId", "invoiceId");
CREATE INDEX IF NOT EXISTS "Claim_tenantId_policyId_idx" ON "Claim"("tenantId", "policyId");

DO $$ BEGIN
  ALTER TABLE "Claim" ADD CONSTRAINT "Claim_policyId_fkey"
    FOREIGN KEY ("policyId") REFERENCES "PatientInsurancePolicy"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Claim" ADD CONSTRAINT "Claim_invoiceId_fkey"
    FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Claim" ADD CONSTRAINT "Claim_appealedClaimId_fkey"
    FOREIGN KEY ("appealedClaimId") REFERENCES "Claim"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
