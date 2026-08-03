import { notFound } from "next/navigation";
import { UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { listStripeInvoicesForCustomer } from "@/lib/stripe/billing-history";
import { getTenantUsage } from "@/lib/features/usage";
import { getTenantDetail } from "@/lib/super-admin/queries";
import { TenantDetailView } from "@/components/super-admin/tenant-detail/tenant-detail-view";

export const runtime = "nodejs";

const AUDIT_PAGE_SIZE = 20;

export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ auditPage?: string }>;
}) {
  const { id } = await params;
  const { auditPage: auditPageParam } = await searchParams;
  const auditPage = Math.max(1, parseInt(auditPageParam ?? "1", 10) || 1);

  const detail = await getTenantDetail(id);
  if (!detail || detail.deletedAt) notFound();

  const [
    branches,
    ownerStaff,
    usage,
    auditTotalCount,
    auditLogs,
    latestAudit,
    latestAppointment,
    latestStaff,
  ] = await Promise.all([
    db.branch.findMany({
      where: { tenantId: id, deletedAt: null },
      orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }],
    }),
    db.staffMember.findFirst({
      where: { tenantId: id, role: UserRole.OWNER, deletedAt: null },
    }),
    getTenantUsage(id),
    db.auditLog.count({ where: { tenantId: id } }),
    db.auditLog.findMany({
      where: { tenantId: id },
      orderBy: { createdAt: "desc" },
      take: AUDIT_PAGE_SIZE,
      skip: (auditPage - 1) * AUDIT_PAGE_SIZE,
      include: { user: true },
    }),
    db.auditLog.findFirst({
      where: { tenantId: id },
      orderBy: { createdAt: "desc" },
      select: { action: true, entity: true, createdAt: true },
    }),
    db.appointment.findFirst({
      where: { tenantId: id, deletedAt: null },
      orderBy: { startTime: "desc" },
      select: { title: true, startTime: true, status: true },
    }),
    db.staffMember.findFirst({
      where: { tenantId: id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { firstName: true, lastName: true, email: true, createdAt: true },
    }),
  ]);

  const ownerAuth = ownerStaff?.authUserId
    ? await db.auth_users.findUnique({
        where: { id: ownerStaff.authUserId },
        select: { name: true, email: true, createdAt: true },
      })
    : null;

  const owner = ownerStaff
    ? {
        name:
          ownerAuth?.name?.trim() ||
          [ownerStaff.firstName, ownerStaff.lastName].filter(Boolean).join(" ") ||
          ownerStaff.email,
        email: ownerStaff.email,
        joinedAt: ownerAuth?.createdAt ?? ownerStaff.createdAt,
      }
    : null;

  let stripeHistory = null;
  let stripeHistoryError = false;
  if (detail.stripeCustomerId) {
    try {
      stripeHistory = await listStripeInvoicesForCustomer(detail.stripeCustomerId);
    } catch {
      stripeHistoryError = true;
    }
  }

  return (
    <TenantDetailView
      tenant={detail}
      branches={branches}
      owner={owner}
      usage={usage}
      totalRevenue={detail.totalRevenue}
      stripeHistory={stripeHistory}
      stripeHistoryError={stripeHistoryError}
      activity={{
        latestAudit,
        latestAppointment,
        latestStaff: latestStaff
          ? {
              name:
                [latestStaff.firstName, latestStaff.lastName]
                  .filter(Boolean)
                  .join(" ") || latestStaff.email,
              createdAt: latestStaff.createdAt,
            }
          : null,
      }}
      auditLogs={auditLogs}
      auditTotalCount={auditTotalCount}
      auditPage={auditPage}
      auditPageSize={AUDIT_PAGE_SIZE}
    />
  );
}
