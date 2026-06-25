CREATE TABLE IF NOT EXISTS "PaymentPlan" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"        TEXT NOT NULL,
  "patientId"       TEXT NOT NULL,
  "invoiceId"       TEXT,
  "planRef"         TEXT,
  "totalAmount"     DECIMAL(10,2) NOT NULL,
  "paidAmount"      DECIMAL(10,2) NOT NULL DEFAULT 0,
  "installments"    INTEGER NOT NULL DEFAULT 1,
  "frequency"       TEXT NOT NULL DEFAULT 'MONTHLY',
  "startDate"       TIMESTAMP(3) NOT NULL,
  "nextDueDate"     TIMESTAMP(3),
  "status"          TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes"           TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PaymentPlan_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentPlan_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "PaymentPlan_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "PaymentPlanInstallment" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "planId"        TEXT NOT NULL,
  "installmentNo" INTEGER NOT NULL,
  "amount"        DECIMAL(10,2) NOT NULL,
  "dueDate"       TIMESTAMP(3) NOT NULL,
  "paidDate"      TIMESTAMP(3),
  "paidAmount"    DECIMAL(10,2),
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "paymentRef"    TEXT,
  CONSTRAINT "PaymentPlanInstallment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PaymentPlanInstallment_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "PaymentPlan"("id") ON DELETE CASCADE
);

ALTER TABLE "Invoice"
  ADD COLUMN IF NOT EXISTS "paymentPlanId" TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceId"   TEXT,
  ADD COLUMN IF NOT EXISTS "patientPortion" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "insurancePortion" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discountReason" TEXT,
  ADD COLUMN IF NOT EXISTS "printedAt"    TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "emailedAt"    TIMESTAMP(3);

ALTER TABLE "Payment"
  ADD COLUMN IF NOT EXISTS "paymentRef"   TEXT,
  ADD COLUMN IF NOT EXISTS "receiptRef"   TEXT,
  ADD COLUMN IF NOT EXISTS "cardLast4"    TEXT,
  ADD COLUMN IF NOT EXISTS "cardBrand"    TEXT,
  ADD COLUMN IF NOT EXISTS "cashReceived" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "changeGiven"  DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "installmentId" TEXT;
