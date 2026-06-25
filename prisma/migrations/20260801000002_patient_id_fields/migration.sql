ALTER TABLE "Patient"
  ADD COLUMN IF NOT EXISTS "patientId"              TEXT,
  ADD COLUMN IF NOT EXISTS "branchCode"             TEXT,
  ADD COLUMN IF NOT EXISTS "branchSeq"              INTEGER,
  ADD COLUMN IF NOT EXISTS "photoUrl"               TEXT,
  ADD COLUMN IF NOT EXISTS "bloodGroup"             TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactName"   TEXT,
  ADD COLUMN IF NOT EXISTS "emergencyContactPhone"  TEXT,
  ADD COLUMN IF NOT EXISTS "referredBy"             TEXT,
  ADD COLUMN IF NOT EXISTS "referralSource"         TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Patient_patientId_key"
  ON "Patient"("patientId") WHERE "patientId" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "Patient_patientId_idx"
  ON "Patient"("patientId");
CREATE INDEX IF NOT EXISTS "Patient_branchCode_idx"
  ON "Patient"("branchCode");
