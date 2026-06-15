import { getPlatformAnalytics, listTenantsWithStats } from "@/lib/super-admin/queries";
import { listPendingApprovalRequests } from "@/lib/tenant/approval";
import { SuperAdminDashboard } from "@/components/super-admin/super-admin-dashboard";

export default async function SuperAdminPage() {
  const [analytics, tenants, pending] = await Promise.all([
    getPlatformAnalytics(),
    listTenantsWithStats(),
    listPendingApprovalRequests(),
  ]);

  return (
    <SuperAdminDashboard
      analytics={analytics}
      tenants={tenants}
      pendingCount={pending.length}
    />
  );
}
