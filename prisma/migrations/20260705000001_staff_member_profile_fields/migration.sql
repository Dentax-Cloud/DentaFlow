-- Staff onboarding profile fields (phone, emergency contact, address, license)
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "addressLine1" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "licenseNumber" TEXT;
