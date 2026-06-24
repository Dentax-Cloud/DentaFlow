-- Photo series tracking
CREATE TABLE IF NOT EXISTS "PhotoSeries" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "patientId"   TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "type"        TEXT NOT NULL DEFAULT 'STANDARD',
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhotoSeries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PhotoSeries_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "PhotoSeries_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE
);

-- Case presentations
CREATE TABLE IF NOT EXISTS "CasePresentation" (
  "id"          TEXT NOT NULL,
  "tenantId"    TEXT NOT NULL,
  "patientId"   TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "imageIds"    TEXT NOT NULL DEFAULT '[]',
  "shareToken"  TEXT,
  "sharedAt"    TIMESTAMP(3),
  "expiresAt"   TIMESTAMP(3),
  "viewCount"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CasePresentation_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CasePresentation_shareToken_key" UNIQUE ("shareToken"),
  CONSTRAINT "CasePresentation_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "CasePresentation_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE
);

-- Add photo fields to ClinicalImage
ALTER TABLE "ClinicalImage"
  ADD COLUMN IF NOT EXISTS "photoSeriesId" TEXT,
  ADD COLUMN IF NOT EXISTS "photoCategory" TEXT,
  ADD COLUMN IF NOT EXISTS "isBeforePhoto"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "afterImageId"   TEXT;

CREATE INDEX IF NOT EXISTS "PhotoSeries_patientId_idx"
  ON "PhotoSeries"("patientId");
CREATE INDEX IF NOT EXISTS "CasePresentation_patientId_idx"
  ON "CasePresentation"("patientId");
CREATE INDEX IF NOT EXISTS "CasePresentation_shareToken_idx"
  ON "CasePresentation"("shareToken");
