import { db } from "@/lib/db";
import { ApprovalStatus, TenantStatus } from "@prisma/client";
import { ensureStripeCustomer } from "./billing";
import { logTenantAudit } from "./audit";
import { AuditAction } from "@prisma/client";

export async function createApprovalRequest(tenantId: string, requestedBy: string) {
  return db.tenantApprovalRequest.create({
    data: {
      tenantId,
      requestedBy,
      status: ApprovalStatus.PENDING,
    },
  });
}

export async function listPendingApprovalRequests() {
  return db.tenantApprovalRequest.findMany({
    where: { status: ApprovalStatus.PENDING },
    include: { tenant: true },
    orderBy: { createdAt: "asc" },
  });
}

export async function approveTenant(
  tenantId: string,
  reviewerClerkUserId: string,
  notes?: string,
) {
  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: { status: TenantStatus.ACTIVE },
  });

  await db.tenantApprovalRequest.updateMany({
    where: { tenantId, status: ApprovalStatus.PENDING },
    data: { status: ApprovalStatus.APPROVED, notes },
  });

  const activated = await ensureStripeCustomer(tenant);

  await logTenantAudit({
    tenantId,
    action: AuditAction.UPDATE,
    entity: "Tenant",
    entityId: tenantId,
    metadata: { status: "ACTIVE", reviewedBy: reviewerClerkUserId },
  });

  return activated;
}

export async function rejectTenant(
  tenantId: string,
  reviewerClerkUserId: string,
  notes?: string,
) {
  const tenant = await db.tenant.update({
    where: { id: tenantId },
    data: { status: TenantStatus.SUSPENDED },
  });

  await db.tenantApprovalRequest.updateMany({
    where: { tenantId, status: ApprovalStatus.PENDING },
    data: { status: ApprovalStatus.REJECTED, notes },
  });

  await logTenantAudit({
    tenantId,
    action: AuditAction.UPDATE,
    entity: "Tenant",
    entityId: tenantId,
    metadata: { status: "SUSPENDED", reviewedBy: reviewerClerkUserId, rejected: true },
  });

  return tenant;
}
