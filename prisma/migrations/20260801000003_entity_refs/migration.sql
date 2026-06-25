ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "staffRef" TEXT,
  ADD COLUMN IF NOT EXISTS "roleCode" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "User_staffRef_key"
  ON "User"("staffRef") WHERE "staffRef" IS NOT NULL;

ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "appointmentRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Appointment_appointmentRef_key"
  ON "Appointment"("appointmentRef") WHERE "appointmentRef" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Appointment_appointmentRef_idx"
  ON "Appointment"("appointmentRef");

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "invoiceRef" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_invoiceRef_key"
  ON "Invoice"("invoiceRef") WHERE "invoiceRef" IS NOT NULL;
