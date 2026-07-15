-- Module 6 Phase 2: additive write-path + billing cutover fields (no destructive changes).

ALTER TABLE "Settings" ADD COLUMN IF NOT EXISTS "encounterSpineSettings" JSONB;

ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "originRecallId" TEXT;
ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "statusBeforeInterrupt" TEXT;
ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "incidentNote" TEXT;
ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "closedReason" TEXT;
ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "painScore" INTEGER;
ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "painNextAction" TEXT;
ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "preAuthOverridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "preAuthOverrideReason" TEXT;
ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "preAuthOverrideByStaffId" TEXT;
ALTER TABLE "Encounter" ADD COLUMN IF NOT EXISTS "patientAckPreAuthAt" TIMESTAMP(3);

ALTER TABLE "EncounterProcedureLine" ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(12,2);
ALTER TABLE "EncounterProcedureLine" ADD COLUMN IF NOT EXISTS "sterilizationLoggedAt" TIMESTAMP(3);
ALTER TABLE "EncounterProcedureLine" ADD COLUMN IF NOT EXISTS "billedInvoiceId" TEXT;

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "encounterId" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_encounterId_key" ON "Invoice"("encounterId");

DO $$ BEGIN
  ALTER TABLE "Invoice"
    ADD CONSTRAINT "Invoice_encounterId_fkey"
    FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
