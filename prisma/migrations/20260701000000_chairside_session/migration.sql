CREATE TABLE IF NOT EXISTS "ChairsideSession" (
  "id"              TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "patientId"       TEXT NOT NULL,
  "appointmentId"   TEXT,
  "staffId"         TEXT,
  "startedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finalizedAt"     TIMESTAMP(3),
  "status"          TEXT NOT NULL DEFAULT 'ACTIVE',
  "notes"           TEXT,
  "invoiceId"       TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChairsideSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChairsideSession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "ChairsideSession_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS "ChairsideEntry" (
  "id"              TEXT NOT NULL,
  "sessionId"       TEXT NOT NULL,
  "tenantId"        TEXT NOT NULL,
  "toothNumber"     INTEGER,
  "surface"         TEXT,
  "procedureCode"   TEXT,
  "procedureName"   TEXT,
  "conditionType"   TEXT,
  "notes"           TEXT,
  "unitPrice"       DECIMAL(10,2) DEFAULT 0,
  "quantity"        INTEGER NOT NULL DEFAULT 1,
  "includeInInvoice" BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChairsideEntry_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChairsideEntry_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "ChairsideSession"("id") ON DELETE CASCADE,
  CONSTRAINT "ChairsideEntry_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "ChairsideSession_tenantId_idx"
  ON "ChairsideSession"("tenantId");
CREATE INDEX IF NOT EXISTS "ChairsideSession_patientId_idx"
  ON "ChairsideSession"("patientId");
CREATE INDEX IF NOT EXISTS "ChairsideSession_appointmentId_idx"
  ON "ChairsideSession"("appointmentId");
CREATE INDEX IF NOT EXISTS "ChairsideEntry_sessionId_idx"
  ON "ChairsideEntry"("sessionId");
