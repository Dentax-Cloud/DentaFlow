-- Module 6 Phase 3a: examination completion and chair preparation.
ALTER TABLE "Encounter"
  ADD COLUMN "examCompletedAt" TIMESTAMP(3),
  ADD COLUMN "examinedByStaffId" TEXT,
  ADD COLUMN "examClinicalNoteId" TEXT;

ALTER TABLE "Encounter"
  ADD CONSTRAINT "Encounter_examinedByStaffId_fkey"
  FOREIGN KEY ("examinedByStaffId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Encounter_examinedByStaffId_idx" ON "Encounter"("examinedByStaffId");

CREATE TABLE "ChairPrepDay" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "chairId" TEXT NOT NULL,
  "prepDate" TEXT NOT NULL,
  "preparedAt" TIMESTAMP(3),
  "preparedByStaffId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChairPrepDay_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChairPrepDay_tenantId_chairId_prepDate_key"
  ON "ChairPrepDay"("tenantId", "chairId", "prepDate");
CREATE INDEX "ChairPrepDay_tenantId_idx" ON "ChairPrepDay"("tenantId");
CREATE INDEX "ChairPrepDay_chairId_idx" ON "ChairPrepDay"("chairId");

ALTER TABLE "ChairPrepDay"
  ADD CONSTRAINT "ChairPrepDay_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChairPrepDay"
  ADD CONSTRAINT "ChairPrepDay_chairId_fkey"
  FOREIGN KEY ("chairId") REFERENCES "Chair"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChairPrepDay"
  ADD CONSTRAINT "ChairPrepDay_preparedByStaffId_fkey"
  FOREIGN KEY ("preparedByStaffId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
