-- Reconcile schema drift (idempotent)
-- Generated from prisma migrate diff; safe to re-run on partially-applied databases.
-- 2026-07-15: also ignore undefined_table so greenfield migrate deploy can skip
-- ALTER/FK/INDEX ops that target tables created by later migrations (e.g. BarcodeScan).
-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "BarcodeScan" DROP CONSTRAINT IF EXISTS "BarcodeScan_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "BookingRequest" DROP CONSTRAINT IF EXISTS "BookingRequest_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "BookingRequest" DROP CONSTRAINT IF EXISTS "BookingRequest_portalAccountId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "BookingRequest" DROP CONSTRAINT IF EXISTS "BookingRequest_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "CasePresentation" DROP CONSTRAINT IF EXISTS "CasePresentation_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "CasePresentation" DROP CONSTRAINT IF EXISTS "CasePresentation_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" DROP CONSTRAINT IF EXISTS "ChairDaySetup_chairId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" DROP CONSTRAINT IF EXISTS "ChairDaySetup_daySessionId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" DROP CONSTRAINT IF EXISTS "ChairDaySetup_templateId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" DROP CONSTRAINT IF EXISTS "ChairDaySetup_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairSetup" DROP CONSTRAINT IF EXISTS "ChairSetup_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairTrayTemplate" DROP CONSTRAINT IF EXISTS "ChairTrayTemplate_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideEntry" DROP CONSTRAINT IF EXISTS "ChairsideEntry_sessionId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideEntry" DROP CONSTRAINT IF EXISTS "ChairsideEntry_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideSession" DROP CONSTRAINT IF EXISTS "ChairsideSession_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideSession" DROP CONSTRAINT IF EXISTS "ChairsideSession_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ClinicalComplianceRecord" DROP CONSTRAINT IF EXISTS "ClinicalComplianceRecord_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ClinicalImage" DROP CONSTRAINT IF EXISTS "ClinicalImage_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ClinicalImage" DROP CONSTRAINT IF EXISTS "ClinicalImage_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "CorporateAccount" DROP CONSTRAINT IF EXISTS "CorporateAccount_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "CountryProcedurePack" DROP CONSTRAINT IF EXISTS "CountryProcedurePack_gpmrId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "DailyCounter" DROP CONSTRAINT IF EXISTS "DailyCounter_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "DaySession" DROP CONSTRAINT IF EXISTS "DaySession_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "DoctorChairSchedule" DROP CONSTRAINT IF EXISTS "DoctorChairSchedule_chairId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "DoctorChairSchedule" DROP CONSTRAINT IF EXISTS "DoctorChairSchedule_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "DoctorSchedule" DROP CONSTRAINT IF EXISTS "DoctorSchedule_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "DoctorScheduleException" DROP CONSTRAINT IF EXISTS "DoctorScheduleException_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "EmergencyIntake" DROP CONSTRAINT IF EXISTS "EmergencyIntake_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "EmergencyIntake" DROP CONSTRAINT IF EXISTS "EmergencyIntake_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ImportBatch" DROP CONSTRAINT IF EXISTS "ImportBatch_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "InsuranceFeeSchedule" DROP CONSTRAINT IF EXISTS "InsuranceFeeSchedule_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "InventoryBatch" DROP CONSTRAINT IF EXISTS "InventoryBatch_inventoryItemId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "InventoryBatch" DROP CONSTRAINT IF EXISTS "InventoryBatch_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "MembershipPlan" DROP CONSTRAINT IF EXISTS "MembershipPlan_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "Notification" DROP CONSTRAINT IF EXISTS "Notification_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "Patient" DROP CONSTRAINT IF EXISTS "Patient_corporateAccountId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientCustomFieldValue" DROP CONSTRAINT IF EXISTS "PatientCustomFieldValue_fieldId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientCustomFieldValue" DROP CONSTRAINT IF EXISTS "PatientCustomFieldValue_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientCustomFieldValue" DROP CONSTRAINT IF EXISTS "PatientCustomFieldValue_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientMembership" DROP CONSTRAINT IF EXISTS "PatientMembership_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientMembership" DROP CONSTRAINT IF EXISTS "PatientMembership_planId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientMembership" DROP CONSTRAINT IF EXISTS "PatientMembership_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientPortalAccount" DROP CONSTRAINT IF EXISTS "PatientPortalAccount_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientPortalAccount" DROP CONSTRAINT IF EXISTS "PatientPortalAccount_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientPortalSession" DROP CONSTRAINT IF EXISTS "PatientPortalSession_accountId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PaymentPlan" DROP CONSTRAINT IF EXISTS "PaymentPlan_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PaymentPlan" DROP CONSTRAINT IF EXISTS "PaymentPlan_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PaymentPlanInstallment" DROP CONSTRAINT IF EXISTS "PaymentPlanInstallment_planId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PerioChart" DROP CONSTRAINT IF EXISTS "PerioChart_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PerioChart" DROP CONSTRAINT IF EXISTS "PerioChart_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PhotoSeries" DROP CONSTRAINT IF EXISTS "PhotoSeries_patientId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PhotoSeries" DROP CONSTRAINT IF EXISTS "PhotoSeries_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PosSession" DROP CONSTRAINT IF EXISTS "PosSession_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ProcedureBundle" DROP CONSTRAINT IF EXISTS "ProcedureBundle_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ProcedureCatalog" DROP CONSTRAINT IF EXISTS "ProcedureCatalog_gpmrId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderItem" DROP CONSTRAINT IF EXISTS "PurchaseOrderItem_inventoryItemId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderItem" DROP CONSTRAINT IF EXISTS "PurchaseOrderItem_purchaseOrderId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "ReferralContact" DROP CONSTRAINT IF EXISTS "ReferralContact_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "SupplierBarcode" DROP CONSTRAINT IF EXISTS "SupplierBarcode_inventoryItemId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "SupplierBarcode" DROP CONSTRAINT IF EXISTS "SupplierBarcode_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "TenantCustomField" DROP CONSTRAINT IF EXISTS "TenantCustomField_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "TenantInsuranceProvider" DROP CONSTRAINT IF EXISTS "TenantInsuranceProvider_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "TenantPaymentMethod" DROP CONSTRAINT IF EXISTS "TenantPaymentMethod_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "TreatmentPlanShare" DROP CONSTRAINT IF EXISTS "TreatmentPlanShare_planId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropForeignKey

DO $$ BEGIN
  ALTER TABLE "TreatmentPlanShare" DROP CONSTRAINT IF EXISTS "TreatmentPlanShare_tenantId_fkey";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- DropIndex

DROP INDEX IF EXISTS "Appointment_appointmentRef_idx";

-- DropIndex

DROP INDEX IF EXISTS "ChairsideSession_appointmentId_idx";

-- DropIndex

DROP INDEX IF EXISTS "ChairsideSession_patientId_idx";

-- DropIndex

DROP INDEX IF EXISTS "ClinicalImage_patientId_idx";

-- DropIndex

DROP INDEX IF EXISTS "ClinicalImage_type_idx";

-- DropIndex

DROP INDEX IF EXISTS "InsuranceFeeSchedule_tenantId_idx";

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "Appointment" ADD COLUMN IF NOT EXISTS "isBlock" BOOLEAN NOT NULL DEFAULT false;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "Appointment" ALTER COLUMN "patientId" DROP NOT NULL;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "BarcodeScan" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "BookingRequest" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "BookingRequest" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ChairSetup" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ChairTrayTemplate" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChairTrayTemplate" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ChairsideEntry" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChairsideEntry" ALTER COLUMN "unitPrice" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ChairsideSession" ADD COLUMN IF NOT EXISTS "noTreatmentReason" TEXT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ChairsideSession" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ClinicalComplianceRecord" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ClinicalImage" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ClinicalNote" ALTER COLUMN "toothNumbers" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "CorporateAccount" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "CountryProcedurePack" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "DailyCounter" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DailyCounter" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "DaySession" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "DoctorChairSchedule" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "DoctorSchedule" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "DoctorSchedule" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "DoctorScheduleException" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "EmergencyIntake" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "GlobalProcedure" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GlobalProcedure" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ImportBatch" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "InsuranceFeeSchedule" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "InventoryBatch" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "InventoryBatch" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "MembershipPlan" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PatientCustomFieldValue" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PatientCustomFieldValue" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PatientMembership" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PatientPortalAccount" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PatientPortalAccount" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PatientPortalSession" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PaymentPlan" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PaymentPlan" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PaymentPlanInstallment" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PerioChart" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PhotoSeries" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PlatformSetting" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PosSession" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ProcedureBundle" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "ProcedureBundle" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ReferralContact" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "SupplierBarcode" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "TenantCustomField" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TenantCustomField" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "TenantInsuranceProvider" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "TenantInsuranceProvider" ALTER COLUMN "updatedAt" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "TenantPaymentMethod" ALTER COLUMN "id" DROP DEFAULT;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
END $$;

-- AlterTable

DO $$ BEGIN
  ALTER TABLE "ToothCondition" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable

CREATE TABLE IF NOT EXISTS "ToothConditionVersion" (
    "id" TEXT NOT NULL,
    "conditionId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "type" "ToothConditionType" NOT NULL,
    "surfaces" TEXT[],
    "severity" INTEGER,
    "mobility" INTEGER,
    "pocketDepth" DOUBLE PRECISION,
    "notes" TEXT,
    "amendedById" TEXT,
    "amendedByName" TEXT,
    "amendReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ToothConditionVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable

CREATE TABLE IF NOT EXISTS "ChairsideEntryVersion" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "toothNumber" INTEGER,
    "surface" TEXT,
    "procedureCode" TEXT,
    "procedureName" TEXT,
    "conditionType" TEXT,
    "notes" TEXT,
    "unitPrice" DECIMAL(10,2),
    "quantity" INTEGER NOT NULL,
    "includeInInvoice" BOOLEAN NOT NULL,
    "amendedById" TEXT,
    "amendedByName" TEXT,
    "amendReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChairsideEntryVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ToothConditionVersion_conditionId_idx" ON "ToothConditionVersion"("conditionId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ToothConditionVersion_tenantId_idx" ON "ToothConditionVersion"("tenantId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ChairsideEntryVersion_entryId_idx" ON "ChairsideEntryVersion"("entryId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ChairsideEntryVersion_tenantId_idx" ON "ChairsideEntryVersion"("tenantId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "BookingRequest_bookingRef_key" ON "BookingRequest"("bookingRef");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "CasePresentation_tenantId_idx" ON "CasePresentation"("tenantId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ChairsideEntry_tenantId_idx" ON "ChairsideEntry"("tenantId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ChairsideSession_tenantId_patientId_idx" ON "ChairsideSession"("tenantId", "patientId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ChairsideSession_tenantId_appointmentId_idx" ON "ChairsideSession"("tenantId", "appointmentId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ClinicalImage_tenantId_patientId_idx" ON "ClinicalImage"("tenantId", "patientId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "ClinicalImage_tenantId_type_idx" ON "ClinicalImage"("tenantId", "type");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "DaySession_tenantId_sessionDate_branchId_key" ON "DaySession"("tenantId", "sessionDate", "branchId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "InsuranceFeeSchedule_tenantId_providerCode_idx" ON "InsuranceFeeSchedule"("tenantId", "providerCode");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE UNIQUE INDEX IF NOT EXISTS "PatientPortalAccount_patientId_key" ON "PatientPortalAccount"("patientId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "PaymentPlan_tenantId_idx" ON "PaymentPlan"("tenantId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "PaymentPlan_tenantId_patientId_idx" ON "PaymentPlan"("tenantId", "patientId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "PaymentPlanInstallment_planId_idx" ON "PaymentPlanInstallment"("planId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "PhotoSeries_tenantId_idx" ON "PhotoSeries"("tenantId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "TreatmentItem_tenantId_visitNumber_idx" ON "TreatmentItem"("tenantId", "visitNumber");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "TreatmentPlan_tenantId_parentPlanId_idx" ON "TreatmentPlan"("tenantId", "parentPlanId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- CreateIndex

DO $$ BEGIN
  CREATE INDEX IF NOT EXISTS "User_authUserId_idx" ON "User"("authUserId");
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "Patient" ADD CONSTRAINT "Patient_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ToothConditionVersion" ADD CONSTRAINT "ToothConditionVersion_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "ToothCondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ToothConditionVersion" ADD CONSTRAINT "ToothConditionVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PerioChart" ADD CONSTRAINT "PerioChart_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PerioChart" ADD CONSTRAINT "PerioChart_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideSession" ADD CONSTRAINT "ChairsideSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideSession" ADD CONSTRAINT "ChairsideSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideEntry" ADD CONSTRAINT "ChairsideEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChairsideSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideEntry" ADD CONSTRAINT "ChairsideEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideEntryVersion" ADD CONSTRAINT "ChairsideEntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ChairsideEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairsideEntryVersion" ADD CONSTRAINT "ChairsideEntryVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_parentPlanId_fkey" FOREIGN KEY ("parentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "TreatmentPlanShare" ADD CONSTRAINT "TreatmentPlanShare_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "TreatmentPlanShare" ADD CONSTRAINT "TreatmentPlanShare_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ClinicalImage" ADD CONSTRAINT "ClinicalImage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ClinicalImage" ADD CONSTRAINT "ClinicalImage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PhotoSeries" ADD CONSTRAINT "PhotoSeries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PhotoSeries" ADD CONSTRAINT "PhotoSeries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "CasePresentation" ADD CONSTRAINT "CasePresentation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "CasePresentation" ADD CONSTRAINT "CasePresentation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "EmergencyIntake" ADD CONSTRAINT "EmergencyIntake_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "EmergencyIntake" ADD CONSTRAINT "EmergencyIntake_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ProcedureCatalog" ADD CONSTRAINT "ProcedureCatalog_gpmrId_fkey" FOREIGN KEY ("gpmrId") REFERENCES "GlobalProcedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "DailyCounter" ADD CONSTRAINT "DailyCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "BarcodeScan" ADD CONSTRAINT "BarcodeScan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "SupplierBarcode" ADD CONSTRAINT "SupplierBarcode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "SupplierBarcode" ADD CONSTRAINT "SupplierBarcode_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairSetup" ADD CONSTRAINT "ChairSetup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairTrayTemplate" ADD CONSTRAINT "ChairTrayTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "DoctorChairSchedule" ADD CONSTRAINT "DoctorChairSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "DoctorChairSchedule" ADD CONSTRAINT "DoctorChairSchedule_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "Chair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "DoctorScheduleException" ADD CONSTRAINT "DoctorScheduleException_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "DaySession" ADD CONSTRAINT "DaySession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" ADD CONSTRAINT "ChairDaySetup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" ADD CONSTRAINT "ChairDaySetup_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "Chair"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" ADD CONSTRAINT "ChairDaySetup_daySessionId_fkey" FOREIGN KEY ("daySessionId") REFERENCES "DaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ChairDaySetup" ADD CONSTRAINT "ChairDaySetup_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChairTrayTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PaymentPlanInstallment" ADD CONSTRAINT "PaymentPlanInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "TenantInsuranceProvider" ADD CONSTRAINT "TenantInsuranceProvider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "InsuranceFeeSchedule" ADD CONSTRAINT "InsuranceFeeSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "TenantCustomField" ADD CONSTRAINT "TenantCustomField_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientCustomFieldValue" ADD CONSTRAINT "PatientCustomFieldValue_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientCustomFieldValue" ADD CONSTRAINT "PatientCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "TenantCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientMembership" ADD CONSTRAINT "PatientMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientMembership" ADD CONSTRAINT "PatientMembership_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientMembership" ADD CONSTRAINT "PatientMembership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "CorporateAccount" ADD CONSTRAINT "CorporateAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "TenantPaymentMethod" ADD CONSTRAINT "TenantPaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ReferralContact" ADD CONSTRAINT "ReferralContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientPortalAccount" ADD CONSTRAINT "PatientPortalAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientPortalAccount" ADD CONSTRAINT "PatientPortalAccount_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "PatientPortalSession" ADD CONSTRAINT "PatientPortalSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PatientPortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "PatientPortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "CountryProcedurePack" ADD CONSTRAINT "CountryProcedurePack_gpmrId_fkey" FOREIGN KEY ("gpmrId") REFERENCES "GlobalProcedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ProcedureBundle" ADD CONSTRAINT "ProcedureBundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey

DO $$ BEGIN
  ALTER TABLE "ClinicalComplianceRecord" ADD CONSTRAINT "ClinicalComplianceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN duplicate_object THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "ClinicalComplianceRecord_tenant_patient_idx" RENAME TO "ClinicalComplianceRecord_tenantId_patientId_idx";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "CountryProcedurePack_gpmrId_country_key" RENAME TO "CountryProcedurePack_gpmrId_countryCode_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "DailyCounter_tenant_date_entity_key" RENAME TO "DailyCounter_tenantId_date_entity_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "DoctorChairSchedule_tenantId_date_idx" RENAME TO "DoctorChairSchedule_tenantId_scheduleDate_idx";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "DoctorScheduleException_tenantId_idx" RENAME TO "DoctorScheduleException_tenantId_doctorId_idx";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "DoctorScheduleException_unique_idx" RENAME TO "DoctorScheduleException_tenantId_doctorId_date_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "InventoryBatch_itemId_idx" RENAME TO "InventoryBatch_inventoryItemId_idx";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "PatientCustomFieldValue_patient_field_key" RENAME TO "PatientCustomFieldValue_patientId_fieldId_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "PatientCustomFieldValue_tenantId_idx" RENAME TO "PatientCustomFieldValue_tenantId_patientId_idx";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "PatientMembership_tenantId_idx" RENAME TO "PatientMembership_tenantId_patientId_idx";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "SupplierBarcode_itemId_idx" RENAME TO "SupplierBarcode_inventoryItemId_idx";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "SupplierBarcode_tenant_barcode_key" RENAME TO "SupplierBarcode_tenantId_barcode_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "TenantCustomField_tenantId_idx" RENAME TO "TenantCustomField_tenantId_entity_idx";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "TenantCustomField_tenant_entity_key_idx" RENAME TO "TenantCustomField_tenantId_entity_fieldKey_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "TenantInsuranceProvider_tenant_code_key" RENAME TO "TenantInsuranceProvider_tenantId_code_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "TenantPaymentMethod_tenant_name_key" RENAME TO "TenantPaymentMethod_tenantId_name_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "vt_identifier_token_key" RENAME TO "verification_tokens_identifier_token_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;

-- RenameIndex

DO $$ BEGIN
  ALTER INDEX "vt_token_key" RENAME TO "verification_tokens_token_key";
EXCEPTION
  WHEN undefined_table THEN NULL;
  WHEN undefined_object THEN NULL;
  WHEN duplicate_table THEN NULL;
END $$;
