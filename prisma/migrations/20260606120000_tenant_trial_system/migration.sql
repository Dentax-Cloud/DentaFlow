-- Add EXPIRED to subscription lifecycle enum (must be committed before use in UPDATE)
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

-- Trial & billing period tracking on Tenant
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "trialEndsAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "currentPeriodEnd" TIMESTAMP(3);

-- Backfill: existing TRIALING tenants get 14-day window from creation
UPDATE "Tenant"
SET "trialEndsAt" = "createdAt" + INTERVAL '14 days'
WHERE "trialEndsAt" IS NULL
  AND "subscriptionStatus" = 'TRIALING';
