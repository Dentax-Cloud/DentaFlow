CREATE TABLE IF NOT EXISTS "EmergencyIntake" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "patientId"       TEXT NOT NULL,
  "appointmentId"   TEXT,
  "chiefComplaint"  TEXT NOT NULL,
  "painScore"       INTEGER NOT NULL DEFAULT 0,
  "painLocation"    TEXT,
  "onset"           TEXT,
  "aggravating"     TEXT,
  "relieving"       TEXT,
  "vitals"          JSONB,
  "allergies"       TEXT,
  "medications"     TEXT,
  "clinicalNote"    TEXT,
  "suggestedCodes"  JSONB,
  "triageLevel"     TEXT NOT NULL DEFAULT 'ROUTINE',
  "attendedById"    TEXT,
  "status"          TEXT NOT NULL DEFAULT 'WAITING',
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmergencyIntake_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmergencyIntake_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "EmergencyIntake_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "EmergencyIntake_tenantId_idx"
  ON "EmergencyIntake"("tenantId");
CREATE INDEX IF NOT EXISTS "EmergencyIntake_patientId_idx"
  ON "EmergencyIntake"("patientId");
CREATE INDEX IF NOT EXISTS "EmergencyIntake_status_idx"
  ON "EmergencyIntake"("status");
CREATE INDEX IF NOT EXISTS "EmergencyIntake_createdAt_idx"
  ON "EmergencyIntake"("createdAt");
