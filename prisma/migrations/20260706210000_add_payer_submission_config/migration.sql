-- CreateEnum
CREATE TYPE "ClaimSubmissionMethod" AS ENUM ('EMAIL', 'PORTAL', 'CLEARINGHOUSE', 'MANUAL');

-- AlterTable
ALTER TABLE "TenantInsuranceProvider"
ADD COLUMN "claimSubmissionMethod" "ClaimSubmissionMethod" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "claimsPortalUrl" TEXT,
ADD COLUMN "turnaroundDays" INTEGER;

-- Backfill: providers with a claims email default to EMAIL submission
UPDATE "TenantInsuranceProvider"
SET "claimSubmissionMethod" = 'EMAIL'
WHERE "claimEmail" IS NOT NULL AND TRIM("claimEmail") <> '';
