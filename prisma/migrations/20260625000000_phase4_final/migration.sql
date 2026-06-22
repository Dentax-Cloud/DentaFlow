-- Extend UserRole enum with roles used in application code
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'DOCTOR';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'FINANCE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STORE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'NURSE';
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'STAFF';

-- Add performedById to AuditLog (mirrors userId for explicit performer tracking)
ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "performedById" TEXT;
