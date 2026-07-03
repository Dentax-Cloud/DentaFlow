-- CreateEnum
CREATE TYPE "PreAuthStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'PARTIALLY_APPROVED', 'DENIED', 'EXPIRED');

-- CreateTable
CREATE TABLE "TreatmentEstimate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "treatmentPlanId" TEXT,
    "policyId" TEXT,
    "procedureCodes" JSONB NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "estimatedInsurerAmount" DECIMAL(12,2) NOT NULL,
    "estimatedPatientAmount" DECIMAL(12,2) NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "generatedBy" TEXT NOT NULL,
    "pdfUrl" TEXT,

    CONSTRAINT "TreatmentEstimate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreAuthorization" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "estimateId" TEXT,
    "policyId" TEXT NOT NULL,
    "status" "PreAuthStatus" NOT NULL DEFAULT 'DRAFT',
    "referenceNumber" TEXT,
    "submittedAt" TIMESTAMP(3),
    "decisionAt" TIMESTAMP(3),
    "approvedInsurerAmount" DECIMAL(12,2),
    "approvedPatientAmount" DECIMAL(12,2),
    "denialReason" TEXT,
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreAuthorization_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TreatmentEstimate_tenantId_patientId_idx" ON "TreatmentEstimate"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "TreatmentEstimate_tenantId_treatmentPlanId_idx" ON "TreatmentEstimate"("tenantId", "treatmentPlanId");

-- CreateIndex
CREATE INDEX "PreAuthorization_tenantId_policyId_idx" ON "PreAuthorization"("tenantId", "policyId");

-- CreateIndex
CREATE INDEX "PreAuthorization_tenantId_estimateId_idx" ON "PreAuthorization"("tenantId", "estimateId");

-- AddForeignKey
ALTER TABLE "TreatmentEstimate" ADD CONSTRAINT "TreatmentEstimate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentEstimate" ADD CONSTRAINT "TreatmentEstimate_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentEstimate" ADD CONSTRAINT "TreatmentEstimate_treatmentPlanId_fkey" FOREIGN KEY ("treatmentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentEstimate" ADD CONSTRAINT "TreatmentEstimate_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PatientInsurancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthorization" ADD CONSTRAINT "PreAuthorization_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthorization" ADD CONSTRAINT "PreAuthorization_estimateId_fkey" FOREIGN KEY ("estimateId") REFERENCES "TreatmentEstimate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreAuthorization" ADD CONSTRAINT "PreAuthorization_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PatientInsurancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
