CREATE TABLE IF NOT EXISTS "ClinicalImage" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "patientId"       TEXT NOT NULL,
  "uploadedById"    TEXT,
  "type"            TEXT NOT NULL DEFAULT 'XRAY',
  "subtype"         TEXT,
  "url"             TEXT NOT NULL,
  "thumbnailUrl"    TEXT,
  "fileName"        TEXT,
  "fileSize"        INTEGER,
  "mimeType"        TEXT,
  "width"           INTEGER,
  "height"          INTEGER,
  "toothNumbers"    TEXT,
  "quadrant"        TEXT,
  "notes"           TEXT,
  "annotations"     JSONB,
  "takenAt"         TIMESTAMP(3),
  "appointmentId"   TEXT,
  "treatmentPlanId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ClinicalImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ClinicalImage_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "ClinicalImage_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ClinicalImage_tenantId_idx"
  ON "ClinicalImage"("tenantId");
CREATE INDEX IF NOT EXISTS "ClinicalImage_patientId_idx"
  ON "ClinicalImage"("patientId");
CREATE INDEX IF NOT EXISTS "ClinicalImage_type_idx"
  ON "ClinicalImage"("type");
