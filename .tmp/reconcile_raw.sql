node.exe : warn The configuration property `package.json#prisma` is deprecated and will be removed in Prisma 7. Please 
migrate to a Prisma config file (e.g., `prisma.config.ts`).
At C:\Users\Gopi\AppData\Roaming\npm\npx.ps1:24 char:5
+     & "node$exe"  "$basedir/node_modules/npm/bin/npx-cli.js" $args
+     ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    + CategoryInfo          : NotSpecified: (warn The config...ma.config.ts`).:String) [], RemoteException
    + FullyQualifiedErrorId : NativeCommandError
 
For more information, see: https://pris.ly/prisma-config

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_patientId_fkey";

-- DropForeignKey
ALTER TABLE "BarcodeScan" DROP CONSTRAINT "BarcodeScan_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "BookingRequest" DROP CONSTRAINT "BookingRequest_patientId_fkey";

-- DropForeignKey
ALTER TABLE "BookingRequest" DROP CONSTRAINT "BookingRequest_portalAccountId_fkey";

-- DropForeignKey
ALTER TABLE "BookingRequest" DROP CONSTRAINT "BookingRequest_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CasePresentation" DROP CONSTRAINT "CasePresentation_patientId_fkey";

-- DropForeignKey
ALTER TABLE "CasePresentation" DROP CONSTRAINT "CasePresentation_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ChairDaySetup" DROP CONSTRAINT "ChairDaySetup_chairId_fkey";

-- DropForeignKey
ALTER TABLE "ChairDaySetup" DROP CONSTRAINT "ChairDaySetup_daySessionId_fkey";

-- DropForeignKey
ALTER TABLE "ChairDaySetup" DROP CONSTRAINT "ChairDaySetup_templateId_fkey";

-- DropForeignKey
ALTER TABLE "ChairDaySetup" DROP CONSTRAINT "ChairDaySetup_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ChairSetup" DROP CONSTRAINT "ChairSetup_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ChairTrayTemplate" DROP CONSTRAINT "ChairTrayTemplate_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ChairsideEntry" DROP CONSTRAINT "ChairsideEntry_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "ChairsideEntry" DROP CONSTRAINT "ChairsideEntry_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ChairsideSession" DROP CONSTRAINT "ChairsideSession_patientId_fkey";

-- DropForeignKey
ALTER TABLE "ChairsideSession" DROP CONSTRAINT "ChairsideSession_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ClinicalComplianceRecord" DROP CONSTRAINT "ClinicalComplianceRecord_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ClinicalImage" DROP CONSTRAINT "ClinicalImage_patientId_fkey";

-- DropForeignKey
ALTER TABLE "ClinicalImage" DROP CONSTRAINT "ClinicalImage_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CorporateAccount" DROP CONSTRAINT "CorporateAccount_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "CountryProcedurePack" DROP CONSTRAINT "CountryProcedurePack_gpmrId_fkey";

-- DropForeignKey
ALTER TABLE "DailyCounter" DROP CONSTRAINT "DailyCounter_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "DaySession" DROP CONSTRAINT "DaySession_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorChairSchedule" DROP CONSTRAINT "DoctorChairSchedule_chairId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorChairSchedule" DROP CONSTRAINT "DoctorChairSchedule_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorSchedule" DROP CONSTRAINT "DoctorSchedule_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "DoctorScheduleException" DROP CONSTRAINT "DoctorScheduleException_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "EmergencyIntake" DROP CONSTRAINT "EmergencyIntake_patientId_fkey";

-- DropForeignKey
ALTER TABLE "EmergencyIntake" DROP CONSTRAINT "EmergencyIntake_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ImportBatch" DROP CONSTRAINT "ImportBatch_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "InsuranceFeeSchedule" DROP CONSTRAINT "InsuranceFeeSchedule_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryBatch" DROP CONSTRAINT "InventoryBatch_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "InventoryBatch" DROP CONSTRAINT "InventoryBatch_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "MembershipPlan" DROP CONSTRAINT "MembershipPlan_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Notification" DROP CONSTRAINT "Notification_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "Patient" DROP CONSTRAINT "Patient_corporateAccountId_fkey";

-- DropForeignKey
ALTER TABLE "PatientCustomFieldValue" DROP CONSTRAINT "PatientCustomFieldValue_fieldId_fkey";

-- DropForeignKey
ALTER TABLE "PatientCustomFieldValue" DROP CONSTRAINT "PatientCustomFieldValue_patientId_fkey";

-- DropForeignKey
ALTER TABLE "PatientCustomFieldValue" DROP CONSTRAINT "PatientCustomFieldValue_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PatientMembership" DROP CONSTRAINT "PatientMembership_patientId_fkey";

-- DropForeignKey
ALTER TABLE "PatientMembership" DROP CONSTRAINT "PatientMembership_planId_fkey";

-- DropForeignKey
ALTER TABLE "PatientMembership" DROP CONSTRAINT "PatientMembership_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PatientPortalAccount" DROP CONSTRAINT "PatientPortalAccount_patientId_fkey";

-- DropForeignKey
ALTER TABLE "PatientPortalAccount" DROP CONSTRAINT "PatientPortalAccount_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PatientPortalSession" DROP CONSTRAINT "PatientPortalSession_accountId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentPlan" DROP CONSTRAINT "PaymentPlan_patientId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentPlan" DROP CONSTRAINT "PaymentPlan_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PaymentPlanInstallment" DROP CONSTRAINT "PaymentPlanInstallment_planId_fkey";

-- DropForeignKey
ALTER TABLE "PerioChart" DROP CONSTRAINT "PerioChart_patientId_fkey";

-- DropForeignKey
ALTER TABLE "PerioChart" DROP CONSTRAINT "PerioChart_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PhotoSeries" DROP CONSTRAINT "PhotoSeries_patientId_fkey";

-- DropForeignKey
ALTER TABLE "PhotoSeries" DROP CONSTRAINT "PhotoSeries_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PosSession" DROP CONSTRAINT "PosSession_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ProcedureBundle" DROP CONSTRAINT "ProcedureBundle_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "ProcedureCatalog" DROP CONSTRAINT "ProcedureCatalog_gpmrId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT "PurchaseOrder_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "PurchaseOrderItem" DROP CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey";

-- DropForeignKey
ALTER TABLE "ReferralContact" DROP CONSTRAINT "ReferralContact_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "SupplierBarcode" DROP CONSTRAINT "SupplierBarcode_inventoryItemId_fkey";

-- DropForeignKey
ALTER TABLE "SupplierBarcode" DROP CONSTRAINT "SupplierBarcode_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantCustomField" DROP CONSTRAINT "TenantCustomField_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantInsuranceProvider" DROP CONSTRAINT "TenantInsuranceProvider_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TenantPaymentMethod" DROP CONSTRAINT "TenantPaymentMethod_tenantId_fkey";

-- DropForeignKey
ALTER TABLE "TreatmentPlanShare" DROP CONSTRAINT "TreatmentPlanShare_planId_fkey";

-- DropForeignKey
ALTER TABLE "TreatmentPlanShare" DROP CONSTRAINT "TreatmentPlanShare_tenantId_fkey";

-- DropIndex
DROP INDEX "Appointment_appointmentRef_idx";

-- DropIndex
DROP INDEX "ChairsideSession_appointmentId_idx";

-- DropIndex
DROP INDEX "ChairsideSession_patientId_idx";

-- DropIndex
DROP INDEX "ClinicalImage_patientId_idx";

-- DropIndex
DROP INDEX "ClinicalImage_type_idx";

-- DropIndex
DROP INDEX "InsuranceFeeSchedule_tenantId_idx";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "isBlock" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "patientId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "BarcodeScan" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "BookingRequest" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChairDaySetup" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChairSetup" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChairTrayTemplate" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChairsideEntry" ADD COLUMN     "lockedAt" TIMESTAMP(3),
ALTER COLUMN "unitPrice" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ChairsideSession" ADD COLUMN     "noTreatmentReason" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ClinicalComplianceRecord" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ClinicalImage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ClinicalNote" ALTER COLUMN "toothNumbers" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CorporateAccount" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "CountryProcedurePack" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DailyCounter" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DaySession" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DoctorChairSchedule" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DoctorSchedule" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "DoctorScheduleException" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "EmergencyIntake" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "GlobalProcedure" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ImportBatch" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InsuranceFeeSchedule" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "InventoryBatch" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "MembershipPlan" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PatientCustomFieldValue" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PatientMembership" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PatientPortalAccount" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PatientPortalSession" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentPlan" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PaymentPlanInstallment" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PerioChart" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PhotoSeries" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PlatformSetting" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PosSession" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ProcedureBundle" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PurchaseOrder" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "PurchaseOrderItem" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ReferralContact" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "SupplierBarcode" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TenantCustomField" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TenantInsuranceProvider" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "TenantPaymentMethod" ALTER COLUMN "id" DROP DEFAULT;

-- AlterTable
ALTER TABLE "ToothCondition" ADD COLUMN     "lockedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ToothConditionVersion" (
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
CREATE TABLE "ChairsideEntryVersion" (
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
CREATE INDEX "ToothConditionVersion_conditionId_idx" ON "ToothConditionVersion"("conditionId");

-- CreateIndex
CREATE INDEX "ToothConditionVersion_tenantId_idx" ON "ToothConditionVersion"("tenantId");

-- CreateIndex
CREATE INDEX "ChairsideEntryVersion_entryId_idx" ON "ChairsideEntryVersion"("entryId");

-- CreateIndex
CREATE INDEX "ChairsideEntryVersion_tenantId_idx" ON "ChairsideEntryVersion"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "BookingRequest_bookingRef_key" ON "BookingRequest"("bookingRef");

-- CreateIndex
CREATE INDEX "CasePresentation_tenantId_idx" ON "CasePresentation"("tenantId");

-- CreateIndex
CREATE INDEX "ChairsideEntry_tenantId_idx" ON "ChairsideEntry"("tenantId");

-- CreateIndex
CREATE INDEX "ChairsideSession_tenantId_patientId_idx" ON "ChairsideSession"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "ChairsideSession_tenantId_appointmentId_idx" ON "ChairsideSession"("tenantId", "appointmentId");

-- CreateIndex
CREATE INDEX "ClinicalImage_tenantId_patientId_idx" ON "ClinicalImage"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "ClinicalImage_tenantId_type_idx" ON "ClinicalImage"("tenantId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DaySession_tenantId_sessionDate_branchId_key" ON "DaySession"("tenantId", "sessionDate", "branchId");

-- CreateIndex
CREATE INDEX "InsuranceFeeSchedule_tenantId_providerCode_idx" ON "InsuranceFeeSchedule"("tenantId", "providerCode");

-- CreateIndex
CREATE UNIQUE INDEX "PatientPortalAccount_patientId_key" ON "PatientPortalAccount"("patientId");

-- CreateIndex
CREATE INDEX "PaymentPlan_tenantId_idx" ON "PaymentPlan"("tenantId");

-- CreateIndex
CREATE INDEX "PaymentPlan_tenantId_patientId_idx" ON "PaymentPlan"("tenantId", "patientId");

-- CreateIndex
CREATE INDEX "PaymentPlanInstallment_planId_idx" ON "PaymentPlanInstallment"("planId");

-- CreateIndex
CREATE INDEX "PhotoSeries_tenantId_idx" ON "PhotoSeries"("tenantId");

-- CreateIndex
CREATE INDEX "TreatmentItem_tenantId_visitNumber_idx" ON "TreatmentItem"("tenantId", "visitNumber");

-- CreateIndex
CREATE INDEX "TreatmentPlan_tenantId_parentPlanId_idx" ON "TreatmentPlan"("tenantId", "parentPlanId");

-- CreateIndex
CREATE INDEX "User_authUserId_idx" ON "User"("authUserId");

-- AddForeignKey
ALTER TABLE "Patient" ADD CONSTRAINT "Patient_corporateAccountId_fkey" FOREIGN KEY ("corporateAccountId") REFERENCES "CorporateAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothConditionVersion" ADD CONSTRAINT "ToothConditionVersion_conditionId_fkey" FOREIGN KEY ("conditionId") REFERENCES "ToothCondition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ToothConditionVersion" ADD CONSTRAINT "ToothConditionVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerioChart" ADD CONSTRAINT "PerioChart_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PerioChart" ADD CONSTRAINT "PerioChart_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairsideSession" ADD CONSTRAINT "ChairsideSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairsideSession" ADD CONSTRAINT "ChairsideSession_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairsideEntry" ADD CONSTRAINT "ChairsideEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ChairsideSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairsideEntry" ADD CONSTRAINT "ChairsideEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairsideEntryVersion" ADD CONSTRAINT "ChairsideEntryVersion_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "ChairsideEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairsideEntryVersion" ADD CONSTRAINT "ChairsideEntryVersion_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlan" ADD CONSTRAINT "TreatmentPlan_parentPlanId_fkey" FOREIGN KEY ("parentPlanId") REFERENCES "TreatmentPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanShare" ADD CONSTRAINT "TreatmentPlanShare_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TreatmentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TreatmentPlanShare" ADD CONSTRAINT "TreatmentPlanShare_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalImage" ADD CONSTRAINT "ClinicalImage_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalImage" ADD CONSTRAINT "ClinicalImage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSeries" ADD CONSTRAINT "PhotoSeries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhotoSeries" ADD CONSTRAINT "PhotoSeries_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePresentation" ADD CONSTRAINT "CasePresentation_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CasePresentation" ADD CONSTRAINT "CasePresentation_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyIntake" ADD CONSTRAINT "EmergencyIntake_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmergencyIntake" ADD CONSTRAINT "EmergencyIntake_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureCatalog" ADD CONSTRAINT "ProcedureCatalog_gpmrId_fkey" FOREIGN KEY ("gpmrId") REFERENCES "GlobalProcedure"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransaction" ADD CONSTRAINT "StockTransaction_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "InventoryBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DailyCounter" ADD CONSTRAINT "DailyCounter_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BarcodeScan" ADD CONSTRAINT "BarcodeScan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBarcode" ADD CONSTRAINT "SupplierBarcode_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierBarcode" ADD CONSTRAINT "SupplierBarcode_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryBatch" ADD CONSTRAINT "InventoryBatch_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_inventoryItemId_fkey" FOREIGN KEY ("inventoryItemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PosSession" ADD CONSTRAINT "PosSession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairSetup" ADD CONSTRAINT "ChairSetup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairTrayTemplate" ADD CONSTRAINT "ChairTrayTemplate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorChairSchedule" ADD CONSTRAINT "DoctorChairSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorChairSchedule" ADD CONSTRAINT "DoctorChairSchedule_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "Chair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorSchedule" ADD CONSTRAINT "DoctorSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DoctorScheduleException" ADD CONSTRAINT "DoctorScheduleException_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DaySession" ADD CONSTRAINT "DaySession_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairDaySetup" ADD CONSTRAINT "ChairDaySetup_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairDaySetup" ADD CONSTRAINT "ChairDaySetup_chairId_fkey" FOREIGN KEY ("chairId") REFERENCES "Chair"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairDaySetup" ADD CONSTRAINT "ChairDaySetup_daySessionId_fkey" FOREIGN KEY ("daySessionId") REFERENCES "DaySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChairDaySetup" ADD CONSTRAINT "ChairDaySetup_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ChairTrayTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlan" ADD CONSTRAINT "PaymentPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentPlanInstallment" ADD CONSTRAINT "PaymentPlanInstallment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "PaymentPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantInsuranceProvider" ADD CONSTRAINT "TenantInsuranceProvider_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InsuranceFeeSchedule" ADD CONSTRAINT "InsuranceFeeSchedule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantCustomField" ADD CONSTRAINT "TenantCustomField_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCustomFieldValue" ADD CONSTRAINT "PatientCustomFieldValue_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientCustomFieldValue" ADD CONSTRAINT "PatientCustomFieldValue_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "TenantCustomField"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MembershipPlan" ADD CONSTRAINT "MembershipPlan_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMembership" ADD CONSTRAINT "PatientMembership_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMembership" ADD CONSTRAINT "PatientMembership_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientMembership" ADD CONSTRAINT "PatientMembership_planId_fkey" FOREIGN KEY ("planId") REFERENCES "MembershipPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateAccount" ADD CONSTRAINT "CorporateAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantPaymentMethod" ADD CONSTRAINT "TenantPaymentMethod_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReferralContact" ADD CONSTRAINT "ReferralContact_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPortalAccount" ADD CONSTRAINT "PatientPortalAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPortalAccount" ADD CONSTRAINT "PatientPortalAccount_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientPortalSession" ADD CONSTRAINT "PatientPortalSession_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "PatientPortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingRequest" ADD CONSTRAINT "BookingRequest_portalAccountId_fkey" FOREIGN KEY ("portalAccountId") REFERENCES "PatientPortalAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CountryProcedurePack" ADD CONSTRAINT "CountryProcedurePack_gpmrId_fkey" FOREIGN KEY ("gpmrId") REFERENCES "GlobalProcedure"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureBundle" ADD CONSTRAINT "ProcedureBundle_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClinicalComplianceRecord" ADD CONSTRAINT "ClinicalComplianceRecord_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "ClinicalComplianceRecord_tenant_patient_idx" RENAME TO "ClinicalComplianceRecord_tenantId_patientId_idx";

-- RenameIndex
ALTER INDEX "CountryProcedurePack_gpmrId_country_key" RENAME TO "CountryProcedurePack_gpmrId_countryCode_key";

-- RenameIndex
ALTER INDEX "DailyCounter_tenant_date_entity_key" RENAME TO "DailyCounter_tenantId_date_entity_key";

-- RenameIndex
ALTER INDEX "DoctorChairSchedule_tenantId_date_idx" RENAME TO "DoctorChairSchedule_tenantId_scheduleDate_idx";

-- RenameIndex
ALTER INDEX "DoctorScheduleException_tenantId_idx" RENAME TO "DoctorScheduleException_tenantId_doctorId_idx";

-- RenameIndex
ALTER INDEX "DoctorScheduleException_unique_idx" RENAME TO "DoctorScheduleException_tenantId_doctorId_date_key";

-- RenameIndex
ALTER INDEX "InventoryBatch_itemId_idx" RENAME TO "InventoryBatch_inventoryItemId_idx";

-- RenameIndex
ALTER INDEX "PatientCustomFieldValue_patient_field_key" RENAME TO "PatientCustomFieldValue_patientId_fieldId_key";

-- RenameIndex
ALTER INDEX "PatientCustomFieldValue_tenantId_idx" RENAME TO "PatientCustomFieldValue_tenantId_patientId_idx";

-- RenameIndex
ALTER INDEX "PatientMembership_tenantId_idx" RENAME TO "PatientMembership_tenantId_patientId_idx";

-- RenameIndex
ALTER INDEX "SupplierBarcode_itemId_idx" RENAME TO "SupplierBarcode_inventoryItemId_idx";

-- RenameIndex
ALTER INDEX "SupplierBarcode_tenant_barcode_key" RENAME TO "SupplierBarcode_tenantId_barcode_key";

-- RenameIndex
ALTER INDEX "TenantCustomField_tenantId_idx" RENAME TO "TenantCustomField_tenantId_entity_idx";

-- RenameIndex
ALTER INDEX "TenantCustomField_tenant_entity_key_idx" RENAME TO "TenantCustomField_tenantId_entity_fieldKey_key";

-- RenameIndex
ALTER INDEX "TenantInsuranceProvider_tenant_code_key" RENAME TO "TenantInsuranceProvider_tenantId_code_key";

-- RenameIndex
ALTER INDEX "TenantPaymentMethod_tenant_name_key" RENAME TO "TenantPaymentMethod_tenantId_name_key";

-- RenameIndex
ALTER INDEX "vt_identifier_token_key" RENAME TO "verification_tokens_identifier_token_key";

-- RenameIndex
ALTER INDEX "vt_token_key" RENAME TO "verification_tokens_token_key";

