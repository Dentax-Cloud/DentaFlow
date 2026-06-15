-- Tenant enterprise lifecycle (generate-only; run: pnpm prisma migrate deploy)

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'CLOSED');
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum: add ADMIN to UserRole
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'ADMIN';

-- AlterTable Tenant
ALTER TABLE "Tenant" RENAME COLUMN "onboardingComplete" TO "onboardingCompleted";

ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "status" "TenantStatus" NOT NULL DEFAULT 'PENDING';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "locale" TEXT NOT NULL DEFAULT 'en';
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "featureFlags" JSONB;
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- Backfill: existing clinics that finished onboarding are ACTIVE
UPDATE "Tenant" SET "status" = 'ACTIVE' WHERE "onboardingCompleted" = true;

-- CreateTable
CREATE TABLE "TenantApprovalRequest" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "requestedBy" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TenantApprovalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TenantApprovalRequest_tenantId_idx" ON "TenantApprovalRequest"("tenantId");
CREATE INDEX "TenantApprovalRequest_status_idx" ON "TenantApprovalRequest"("status");

ALTER TABLE "TenantApprovalRequest" ADD CONSTRAINT "TenantApprovalRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
