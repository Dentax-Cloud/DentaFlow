export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { assertHrModuleEnabled } from "@/lib/hr/require-hr";
import { listLeaveTypes } from "@/app/(dashboard)/features/hr/hr-actions";
import { HrLeaveTypesClient } from "./hr-leave-types-client";

export default async function HrLeaveTypesPage() {
  const ctx = await requireRouteAccess("hr", "write");
  assertHrModuleEnabled(ctx.tenant);
  const types = await listLeaveTypes();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Leave types</h1>
      <HrLeaveTypesClient
        types={types.map((t) => ({
          id: t.id,
          name: t.name,
          isPaid: t.isPaid,
          defaultAnnualEntitlement: t.defaultAnnualEntitlement,
        }))}
      />
    </div>
  );
}
