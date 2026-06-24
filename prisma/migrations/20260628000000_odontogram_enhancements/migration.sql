-- AlterEnum
ALTER TYPE "ToothConditionType" ADD VALUE IF NOT EXISTS 'WATCH';
ALTER TYPE "ToothConditionType" ADD VALUE IF NOT EXISTS 'BRIDGE';

-- AlterTable
ALTER TABLE "ToothCondition" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ToothCondition_tenantId_appointmentId_idx" ON "ToothCondition"("tenantId", "appointmentId");
