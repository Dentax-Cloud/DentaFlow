-- Clinical templates & note versioning (Module 8)

CREATE TABLE "ClinicalTemplate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicalTemplate_tenantId_type_idx" ON "ClinicalTemplate"("tenantId", "type");

ALTER TABLE "ClinicalTemplate" ADD CONSTRAINT "ClinicalTemplate_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ClinicalNoteVersion" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "noteId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "subjective" TEXT,
    "objective" TEXT,
    "assessment" TEXT,
    "plan" TEXT,
    "bodyHtml" TEXT,
    "rawNotes" TEXT,
    "editedById" TEXT,
    "editedByName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClinicalNoteVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ClinicalNoteVersion_noteId_version_key" ON "ClinicalNoteVersion"("noteId", "version");
CREATE INDEX "ClinicalNoteVersion_tenantId_noteId_idx" ON "ClinicalNoteVersion"("tenantId", "noteId");

ALTER TABLE "ClinicalNoteVersion" ADD CONSTRAINT "ClinicalNoteVersion_noteId_fkey"
    FOREIGN KEY ("noteId") REFERENCES "ClinicalNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClinicalNoteVersion" ADD CONSTRAINT "ClinicalNoteVersion_tenantId_fkey"
    FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "appointmentId" TEXT;
ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "templateId" TEXT;
ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "noteType" TEXT NOT NULL DEFAULT 'SOAP';
ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "title" TEXT;
ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "bodyHtml" TEXT;
ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "toothNumbers" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "aiEnhanced" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "currentVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);
ALTER TABLE "ClinicalNote" ADD COLUMN IF NOT EXISTS "signedByName" TEXT;

CREATE INDEX IF NOT EXISTS "ClinicalNote_tenantId_appointmentId_idx" ON "ClinicalNote"("tenantId", "appointmentId");

ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_appointmentId_fkey"
    FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ClinicalNote" ADD CONSTRAINT "ClinicalNote_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "ClinicalTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
