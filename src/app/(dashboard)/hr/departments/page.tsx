export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { assertHrModuleEnabled } from "@/lib/hr/require-hr";
import { listDepartments } from "@/app/(dashboard)/features/hr/hr-actions";
import { HrDepartmentsClient } from "./hr-departments-client";

export default async function HrDepartmentsPage() {
  const ctx = await requireRouteAccess("hr", "write");
  assertHrModuleEnabled(ctx.tenant);
  const departments = await listDepartments();

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Departments</h1>
      <HrDepartmentsClient
        departments={departments.map((d) => ({
          id: d.id,
          name: d.name,
          description: d.description,
        }))}
      />
    </div>
  );
}
