-- Patient portal accounts (one per patient per tenant)
CREATE TABLE IF NOT EXISTS "PatientPortalAccount" (
  "id"             TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "portalUserId"   TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "patientId"      TEXT NOT NULL,
  "email"          TEXT NOT NULL,
  "passwordHash"   TEXT NOT NULL,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "isVerified"     BOOLEAN NOT NULL DEFAULT false,
  "verifyToken"    TEXT,
  "verifyExpiry"   TIMESTAMP(3),
  "resetToken"     TEXT,
  "resetExpiry"    TIMESTAMP(3),
  "lastLoginAt"    TIMESTAMP(3),
  "loginAttempts"  INTEGER NOT NULL DEFAULT 0,
  "lockedUntil"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientPortalAccount_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PatientPortalAccount_portalUserId_key" UNIQUE ("portalUserId"),
  CONSTRAINT "PatientPortalAccount_tenantId_patientId_key"
    UNIQUE ("tenantId", "patientId"),
  CONSTRAINT "PatientPortalAccount_tenantId_email_key"
    UNIQUE ("tenantId", "email"),
  CONSTRAINT "PatientPortalAccount_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "PatientPortalAccount_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PatientPortalAccount_tenantId_idx"
  ON "PatientPortalAccount"("tenantId");
CREATE INDEX IF NOT EXISTS "PatientPortalAccount_email_idx"
  ON "PatientPortalAccount"("email");
CREATE INDEX IF NOT EXISTS "PatientPortalAccount_patientId_idx"
  ON "PatientPortalAccount"("patientId");

CREATE TABLE IF NOT EXISTS "PatientPortalSession" (
  "id"        TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "accountId" TEXT NOT NULL,
  "tenantId"  TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PatientPortalSession_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PatientPortalSession_token_key" UNIQUE ("token"),
  CONSTRAINT "PatientPortalSession_accountId_fkey"
    FOREIGN KEY ("accountId") REFERENCES "PatientPortalAccount"("id")
    ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "PatientPortalSession_token_idx"
  ON "PatientPortalSession"("token");
CREATE INDEX IF NOT EXISTS "PatientPortalSession_accountId_idx"
  ON "PatientPortalSession"("accountId");

CREATE TABLE IF NOT EXISTS "BookingRequest" (
  "id"              TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "bookingRef"      TEXT,
  "tenantId"        TEXT NOT NULL,
  "patientId"       TEXT NOT NULL,
  "portalAccountId" TEXT NOT NULL,
  "serviceId"       TEXT,
  "doctorId"        TEXT,
  "branchId"        TEXT,
  "requestedDate"   TEXT NOT NULL,
  "requestedTime"   TEXT NOT NULL,
  "durationMins"    INTEGER NOT NULL DEFAULT 30,
  "notes"           TEXT,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "appointmentId"   TEXT,
  "confirmedAt"     TIMESTAMP(3),
  "rejectedAt"      TIMESTAMP(3),
  "rejectedReason"  TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BookingRequest_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BookingRequest_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "BookingRequest_patientId_fkey"
    FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE,
  CONSTRAINT "BookingRequest_portalAccountId_fkey"
    FOREIGN KEY ("portalAccountId")
    REFERENCES "PatientPortalAccount"("id") ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "BookingRequest_bookingRef_key"
  ON "BookingRequest"("bookingRef") WHERE "bookingRef" IS NOT NULL;
CREATE INDEX IF NOT EXISTS "BookingRequest_tenantId_idx"
  ON "BookingRequest"("tenantId");
CREATE INDEX IF NOT EXISTS "BookingRequest_patientId_idx"
  ON "BookingRequest"("patientId");
CREATE INDEX IF NOT EXISTS "BookingRequest_status_idx"
  ON "BookingRequest"("status");

ALTER TABLE "Tenant"
  ADD COLUMN IF NOT EXISTS "portalEnabled"       BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bookingEnabled"      BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "autoConfirmBooking"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "bookingLeadHours"    INTEGER NOT NULL DEFAULT 24,
  ADD COLUMN IF NOT EXISTS "bookingMaxDays"      INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS "bookingBufferMins"   INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS "portalWelcomeMsg"    TEXT,
  ADD COLUMN IF NOT EXISTS "portalLogoUrl"       TEXT;
