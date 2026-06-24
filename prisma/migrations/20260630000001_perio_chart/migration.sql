CREATE TABLE IF NOT EXISTS "PerioChart" (
  "id"            TEXT NOT NULL,
  "tenantId"      TEXT NOT NULL,
  "patientId"     TEXT NOT NULL,
  "examinerId"    TEXT,
  "chartDate"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "perioStage"    TEXT,
  "perioGrade"    TEXT,
  "bopPercent"    DOUBLE PRECISION,
  "notes"         TEXT,
  "measurements"  JSONB NOT NULL DEFAULT '[]',
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PerioChart_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PerioChart_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "PerioChart_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PerioChart_tenantId_idx" ON "PerioChart"("tenantId");
CREATE INDEX IF NOT EXISTS "PerioChart_tenantId_patientId_idx" ON "PerioChart"("tenantId", "patientId");
