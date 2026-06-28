-- Chair tray templates
CREATE TABLE IF NOT EXISTS "ChairTrayTemplate" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "items"     JSONB NOT NULL DEFAULT '[]',
  "notes"     TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChairTrayTemplate_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChairTrayTemplate_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "ChairTrayTemplate_tenantId_idx"
  ON "ChairTrayTemplate"("tenantId");

-- Doctor-Chair daily schedule
CREATE TABLE IF NOT EXISTS "DoctorChairSchedule" (
  "id"           TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"     TEXT NOT NULL,
  "chairId"      TEXT NOT NULL,
  "doctorId"     TEXT NOT NULL,
  "scheduleDate" TEXT NOT NULL,
  "startTime"    TEXT NOT NULL DEFAULT '09:00',
  "endTime"      TEXT NOT NULL DEFAULT '17:00',
  "shiftType"    TEXT NOT NULL DEFAULT 'FULL_DAY',
  "status"       TEXT NOT NULL DEFAULT 'SCHEDULED',
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorChairSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DoctorChairSchedule_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "DoctorChairSchedule_chairId_fkey"
    FOREIGN KEY ("chairId") REFERENCES "Chair"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "DoctorChairSchedule_tenantId_date_idx"
  ON "DoctorChairSchedule"("tenantId", "scheduleDate");
CREATE INDEX IF NOT EXISTS "DoctorChairSchedule_chairId_idx"
  ON "DoctorChairSchedule"("chairId");

-- Day session (one per tenant per day, optional branch)
CREATE TABLE IF NOT EXISTS "DaySession" (
  "id"          TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"    TEXT NOT NULL,
  "branchId"    TEXT,
  "sessionDate" TEXT NOT NULL,
  "openedAt"    TIMESTAMP(3),
  "openedById"  TEXT,
  "closedAt"    TIMESTAMP(3),
  "closedById"  TEXT,
  "status"      TEXT NOT NULL DEFAULT 'PENDING',
  "summary"     JSONB,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DaySession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DaySession_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "DaySession_tenant_date_branch_key"
  ON "DaySession"("tenantId", "sessionDate", COALESCE("branchId", ''));
CREATE INDEX IF NOT EXISTS "DaySession_tenantId_idx"
  ON "DaySession"("tenantId");

-- Chair day setup
CREATE TABLE IF NOT EXISTS "ChairDaySetup" (
  "id"            TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"      TEXT NOT NULL,
  "chairId"       TEXT NOT NULL,
  "daySessionId"  TEXT NOT NULL,
  "doctorId"      TEXT,
  "templateId"    TEXT,
  "setupItems"    JSONB NOT NULL DEFAULT '[]',
  "returnedItems" JSONB NOT NULL DEFAULT '[]',
  "consumedItems" JSONB NOT NULL DEFAULT '[]',
  "setupCost"     DECIMAL(10,2) NOT NULL DEFAULT 0,
  "status"        TEXT NOT NULL DEFAULT 'PENDING',
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChairDaySetup_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ChairDaySetup_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "ChairDaySetup_chairId_fkey"
    FOREIGN KEY ("chairId") REFERENCES "Chair"("id") ON DELETE CASCADE,
  CONSTRAINT "ChairDaySetup_daySessionId_fkey"
    FOREIGN KEY ("daySessionId") REFERENCES "DaySession"("id") ON DELETE CASCADE,
  CONSTRAINT "ChairDaySetup_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ChairTrayTemplate"("id") ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS "ChairDaySetup_tenantId_idx"
  ON "ChairDaySetup"("tenantId");
CREATE INDEX IF NOT EXISTS "ChairDaySetup_daySessionId_idx"
  ON "ChairDaySetup"("daySessionId");
CREATE INDEX IF NOT EXISTS "ChairDaySetup_chairId_idx"
  ON "ChairDaySetup"("chairId");
