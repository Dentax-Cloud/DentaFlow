-- CreateTable
CREATE TABLE "ProcedureLine" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "appointmentId" TEXT NOT NULL,
    "ownerType" TEXT NOT NULL,
    "ownerId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "procedureCode" TEXT,
    "procedureName" TEXT,
    "unitPrice" DECIMAL(10,2) DEFAULT 0,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "treatmentItemId" TEXT,
    "requiresPreAuth" BOOLEAN NOT NULL DEFAULT false,
    "preAuthStatus" TEXT,
    "closedAt" TIMESTAMP(3),
    "closedById" TEXT,
    "voidReason" TEXT,
    "lockedAt" TIMESTAMP(3),
    "lockedInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcedureLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcedureLine_tenantId_appointmentId_idx" ON "ProcedureLine"("tenantId", "appointmentId");

-- CreateIndex
CREATE INDEX "ProcedureLine_tenantId_status_idx" ON "ProcedureLine"("tenantId", "status");

-- CreateIndex
CREATE INDEX "ProcedureLine_ownerId_idx" ON "ProcedureLine"("ownerId");

-- AddForeignKey
ALTER TABLE "ProcedureLine" ADD CONSTRAINT "ProcedureLine_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcedureLine" ADD CONSTRAINT "ProcedureLine_appointmentId_fkey" FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
