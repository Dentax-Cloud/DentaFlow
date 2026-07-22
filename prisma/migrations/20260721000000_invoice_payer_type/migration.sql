-- CreateEnum
CREATE TYPE "InvoicePayerType" AS ENUM ('SELF_PAY', 'INSURANCE', 'CO_PAY');

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN "payerType" "InvoicePayerType" NOT NULL DEFAULT 'SELF_PAY';
