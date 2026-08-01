-- Allow inventory-scoped material_expiry alerts without an encounter.
ALTER TABLE "ClinicalAlert" ALTER COLUMN "encounterId" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "ClinicalAlert_tenantId_type_sourceRecordId_idx"
  ON "ClinicalAlert"("tenantId", "type", "sourceRecordId");
