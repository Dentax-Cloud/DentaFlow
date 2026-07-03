-- ChairsideSession: distinguish finalized vs abandoned auto-closes for audit/reporting
ALTER TABLE "ChairsideSession" ADD COLUMN IF NOT EXISTS "closedReason" TEXT;
