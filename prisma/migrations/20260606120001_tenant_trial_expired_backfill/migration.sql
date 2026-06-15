-- Mark trials that already passed as EXPIRED (runs after EXPIRED enum value is committed)
UPDATE "Tenant"
SET "subscriptionStatus" = 'EXPIRED'
WHERE "subscriptionStatus" = 'TRIALING'
  AND "trialEndsAt" IS NOT NULL
  AND "trialEndsAt" < NOW()
  AND "stripeSubscriptionId" IS NULL;
