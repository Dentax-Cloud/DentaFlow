-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "ClaimSubmissionMethod" AS ENUM ('EMAIL', 'PORTAL', 'CLEARINGHOUSE', 'MANUAL');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable / backfill only when TenantInsuranceProvider already exists.
-- Table is created later by 20260825000001_tenant_customization; this migration
-- was authored against a drifted environment that already had it.
DO $$ BEGIN
  IF to_regclass('public."TenantInsuranceProvider"') IS NULL THEN
    RAISE NOTICE 'TenantInsuranceProvider missing — skipping payer submission config (applied later via tenant_customization + follow-up)';
    RETURN;
  END IF;

  ALTER TABLE "TenantInsuranceProvider"
    ADD COLUMN IF NOT EXISTS "claimSubmissionMethod" "ClaimSubmissionMethod" NOT NULL DEFAULT 'MANUAL',
    ADD COLUMN IF NOT EXISTS "claimsPortalUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "turnaroundDays" INTEGER;

  UPDATE "TenantInsuranceProvider"
  SET "claimSubmissionMethod" = 'EMAIL'
  WHERE "claimEmail" IS NOT NULL AND TRIM("claimEmail") <> '';
END $$;
