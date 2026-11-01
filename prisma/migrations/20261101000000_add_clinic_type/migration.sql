-- AlterTable
-- Migrate from clinicMode if present, otherwise add clinicType
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Tenant' AND column_name = 'clinicMode') THEN
    ALTER TABLE "Tenant" RENAME COLUMN "clinicMode" TO "clinicType";
    ALTER TABLE "Tenant" ALTER COLUMN "clinicType" SET DEFAULT 'practice';
    UPDATE "Tenant" SET "clinicType" = 'practice' WHERE "clinicType" = 'group';
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Tenant' AND column_name = 'clinicType') THEN
    ALTER TABLE "Tenant" ADD COLUMN "clinicType" TEXT NOT NULL DEFAULT 'practice';
  END IF;
END $$;
