-- Add reminderSentAt and status to Recall
ALTER TABLE "Recall" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "Recall" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'PENDING';

-- Add inventoryConsumption to ProcedureCatalog
ALTER TABLE "ProcedureCatalog" ADD COLUMN IF NOT EXISTS "inventoryConsumption" TEXT;

-- Add campaignId to CommunicationLog
ALTER TABLE "CommunicationLog" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;

-- Add sentAt, recipientCount, targetAudience to Campaign
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "recipientCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Campaign" ADD COLUMN IF NOT EXISTS "targetAudience" TEXT;

-- Add noShowCount to Patient
ALTER TABLE "Patient" ADD COLUMN IF NOT EXISTS "noShowCount" INTEGER NOT NULL DEFAULT 0;
