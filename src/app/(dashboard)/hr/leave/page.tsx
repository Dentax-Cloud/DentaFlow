export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { assertHrModuleEnabled } from "@/lib/hr/require-hr";
import { listPendingLeaveRequests } from "@/app/(dashboard)/features/hr/hr-actions";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { HrLeaveQueueClient } from "./hr-leave-queue-client";

export default async function HrLeaveApprovalsPage() {
  const ctx = await requireRouteAccess("hr", "read");
  assertHrModuleEnabled(ctx.tenant);
  const canWrite = hasPermission(ctx.staffMember!.role, PERMISSIONS.hr.write);
  const pending = await listPendingLeaveRequests();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Leave approvals</h1>
        <p className="text-sm text-muted-foreground">
          {pending.length} pending request{pending.length === 1 ? "" : "s"}
        </p>
      </div>
      <HrLeaveQueueClient
        canWrite={canWrite}
        requests={pending.map((r) => ({
          id: r.id,
          employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
          leaveTypeName: r.leaveType.name,
          startDate: r.startDate.toISOString().slice(0, 10),
          endDate: r.endDate.toISOString().slice(0, 10),
          dayCount: r.dayCount,
          reason: r.reason,
        }))}
      />
    </div>
  );
}
