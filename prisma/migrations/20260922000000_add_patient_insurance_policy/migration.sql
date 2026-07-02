-- CreateEnum
CREATE TYPE "PolicyRank" AS ENUM ('PRIMARY', 'SECONDARY');

-- CreateEnum
CREATE TYPE "SubscriberRelationship" AS ENUM ('SELF', 'SPOUSE', 'CHILD', 'OTHER');

-- CreateTable
CREATE TABLE "PatientInsurancePolicy" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "rank" "PolicyRank" NOT NULL,
    "providerId" TEXT,
    "providerNameFreeText" TEXT,
    "networkTier" TEXT,
    "memberId" TEXT NOT NULL,
    "groupNumber" TEXT,
    "subscriberName" TEXT,
    "subscriberRelationship" "SubscriberRelationship",
    "effectiveDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "cardFrontUrl" TEXT,
    "cardBackUrl" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'NOT_VERIFIED',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verificationExpiresAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PatientInsurancePolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PatientInsurancePolicy_tenantId_patientId_idx" ON "PatientInsurancePolicy"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "PatientInsurancePolicy_tenantId_patientId_rank_isActive_idx" ON "PatientInsurancePolicy"("tenantId", "patientId", "rank", "isActive");

-- AddForeignKey
ALTER TABLE "PatientInsurancePolicy" ADD CONSTRAINT "PatientInsurancePolicy_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurancePolicy" ADD CONSTRAINT "PatientInsurancePolicy_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientInsurancePolicy" ADD CONSTRAINT "PatientInsurancePolicy_providerId_fkey" FOREIGN KEY ("providerId") REFERENCES "TenantInsuranceProvider"("id") ON DELETE SET NULL ON UPDATE CASCADE;
