-- Module 6 Phase 3b: visit share tokens, patient-shareable photos, anaesthesia co-sign.

ALTER TABLE "ClinicalImage" ADD COLUMN "patientShareable" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "EncounterProcedureLine" ADD COLUMN "cosignStaffId" TEXT;
ALTER TABLE "EncounterProcedureLine" ADD COLUMN "cosignActorStaffId" TEXT;
ALTER TABLE "EncounterProcedureLine" ADD COLUMN "cosignAt" TIMESTAMP(3);

ALTER TABLE "EncounterProcedureLine" ADD CONSTRAINT "EncounterProcedureLine_cosignStaffId_fkey" FOREIGN KEY ("cosignStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "EncounterProcedureLine" ADD CONSTRAINT "EncounterProcedureLine_cosignActorStaffId_fkey" FOREIGN KEY ("cosignActorStaffId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "EncounterVisitShare" (
    "id" TEXT NOT NULL,
    "encounterId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "viewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncounterVisitShare_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EncounterVisitShare_token_key" ON "EncounterVisitShare"("token");
CREATE INDEX "EncounterVisitShare_token_idx" ON "EncounterVisitShare"("token");
CREATE INDEX "EncounterVisitShare_tenantId_encounterId_idx" ON "EncounterVisitShare"("tenantId", "encounterId");

ALTER TABLE "EncounterVisitShare" ADD CONSTRAINT "EncounterVisitShare_encounterId_fkey" FOREIGN KEY ("encounterId") REFERENCES "Encounter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EncounterVisitShare" ADD CONSTRAINT "EncounterVisitShare_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
