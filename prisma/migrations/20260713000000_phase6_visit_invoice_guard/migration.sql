-- Phase 6: link invoices to appointments for dual-path guard + interim sequences
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "visitSequence" INTEGER;
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "billingKind" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Invoice_appointmentId_fkey'
  ) THEN
    ALTER TABLE "Invoice"
      ADD CONSTRAINT "Invoice_appointmentId_fkey"
      FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_tenantId_appointmentId_visitSequence_key"
  ON "Invoice" ("tenantId", "appointmentId", "visitSequence");

CREATE INDEX IF NOT EXISTS "Invoice_tenantId_appointmentId_idx"
  ON "Invoice" ("tenantId", "appointmentId");
