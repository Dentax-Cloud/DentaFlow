-- Doctor weekly schedule template
CREATE TABLE IF NOT EXISTS "DoctorSchedule" (
  "id"               TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"         TEXT NOT NULL,
  "doctorId"         TEXT NOT NULL,
  "branchId"         TEXT,
  "dayOfWeek"        INTEGER NOT NULL,
  "isWorkingDay"     BOOLEAN NOT NULL DEFAULT true,
  "startTime"        TEXT NOT NULL DEFAULT '09:00',
  "endTime"          TEXT NOT NULL DEFAULT '17:00',
  "breaks"           JSONB NOT NULL DEFAULT '[]',
  "slotDurationMins" INTEGER NOT NULL DEFAULT 30,
  "bufferMins"       INTEGER NOT NULL DEFAULT 10,
  "maxAppointments"  INTEGER,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorSchedule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DoctorSchedule_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DoctorSchedule_unique_idx"
  ON "DoctorSchedule"(
    "tenantId", "doctorId", "dayOfWeek",
    COALESCE("branchId", '')
  );
CREATE INDEX IF NOT EXISTS "DoctorSchedule_tenantId_doctorId_idx"
  ON "DoctorSchedule"("tenantId", "doctorId");

-- Schedule exceptions (leave, modified hours)
CREATE TABLE IF NOT EXISTS "DoctorScheduleException" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "tenantId"  TEXT NOT NULL,
  "doctorId"  TEXT NOT NULL,
  "date"      TEXT NOT NULL,
  "type"      TEXT NOT NULL DEFAULT 'OFF',
  "startTime" TEXT,
  "endTime"   TEXT,
  "reason"    TEXT,
  "allDay"    BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DoctorScheduleException_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DoctorScheduleException_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
    ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DoctorScheduleException_unique_idx"
  ON "DoctorScheduleException"("tenantId", "doctorId", "date");
CREATE INDEX IF NOT EXISTS "DoctorScheduleException_tenantId_idx"
  ON "DoctorScheduleException"("tenantId", "doctorId");

-- Add fields to Appointment
ALTER TABLE "Appointment"
  ADD COLUMN IF NOT EXISTS "procedureId"   TEXT,
  ADD COLUMN IF NOT EXISTS "bookedById"    TEXT,
  ADD COLUMN IF NOT EXISTS "bookedVia"     TEXT DEFAULT 'RECEPTION',
  ADD COLUMN IF NOT EXISTS "preAuthStatus" TEXT DEFAULT 'NOT_REQUIRED',
  ADD COLUMN IF NOT EXISTS "preAuthCode"   TEXT,
  ADD COLUMN IF NOT EXISTS "cancellationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "cancelledById" TEXT;
