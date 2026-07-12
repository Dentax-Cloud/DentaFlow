-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT 'ROUTINE';
ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "priorityReason" TEXT;
