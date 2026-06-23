-- Tenant billing lifecycle fields
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "suspendedAt" TIMESTAMP(3);
ALTER TABLE "Tenant" ADD COLUMN IF NOT EXISTS "suspendedReason" TEXT;

-- Extend subscription status enum
ALTER TYPE "SubscriptionStatus" ADD VALUE IF NOT EXISTS 'PAUSED';

-- Email verification tokens (NextAuth-compatible shape)
CREATE TABLE IF NOT EXISTS "verification_tokens" (
  "identifier" TEXT NOT NULL,
  "token" TEXT NOT NULL,
  "expires" TIMESTAMP(3) NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "vt_token_key" ON "verification_tokens"("token");
CREATE UNIQUE INDEX IF NOT EXISTS "vt_identifier_token_key"
  ON "verification_tokens"("identifier", "token");
