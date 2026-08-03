export const runtime = "nodejs";

import Link from "next/link";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { assertHrModuleEnabled } from "@/lib/hr/require-hr";
import { db } from "@/lib/db";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import {
  credentialExpiryWindowDays,
  isCredentialExpiringSoon,
} from "@/lib/hr/credential-expiry";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HrEmployeeCreateForm } from "./hr-employee-create-form";

export default async function HrDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string }>;
}) {
  const ctx = await requireRouteAccess("hr", "read");
  assertHrModuleEnabled(ctx.tenant);
  const sp = await searchParams;
  const canWrite = hasPermission(ctx.staffMember!.role, PERMISSIONS.hr.write);

  const [employees, departments, expiringDocs] = await Promise.all([
    db.employee.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        ...(sp.status ? { employmentStatus: sp.status } : {}),
        ...(sp.type ? { employmentType: sp.type } : {}),
        ...(sp.q?.trim()
          ? {
              OR: [
                { firstName: { contains: sp.q.trim(), mode: "insensitive" } },
                { lastName: { contains: sp.q.trim(), mode: "insensitive" } },
                { email: { contains: sp.q.trim(), mode: "insensitive" } },
              ],
            }
          : {}),
      },
      include: { department: { select: { name: true } } },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    db.department.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { name: "asc" },
    }),
    db.employeeDocument.findMany({
      where: {
        tenantId: ctx.tenantId,
        deletedAt: null,
        expiresAt: { not: null },
        documentType: { in: ["credential", "id"] },
      },
      include: {
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
    }),
  ]);

  const windowDays = credentialExpiryWindowDays();
  const now = new Date();
  const expiring = expiringDocs.filter((d) =>
    isCredentialExpiringSoon(d.expiresAt, now, windowDays),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">HR directory</h1>
          <p className="text-sm text-muted-foreground">
            {employees.length} employee{employees.length === 1 ? "" : "s"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/hr/leave">Leave approvals</Link>
          </Button>
          {canWrite && (
            <>
              <Button variant="outline" size="sm" asChild>
                <Link href="/hr/departments">Departments</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/hr/leave-types">Leave types</Link>
              </Button>
            </>
          )}
        </div>
      </div>

      {expiring.length > 0 && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-amber-900 dark:text-amber-100">
              Credentials expiring within {windowDays} days
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {expiring.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary">Expiring</Badge>
                <Link
                  href={`/hr/employees/${d.employee.id}`}
                  className="font-medium hover:underline"
                >
                  {d.employee.firstName} {d.employee.lastName}
                </Link>
                <span className="text-muted-foreground">
                  {d.title} · {d.expiresAt?.toISOString().slice(0, 10)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <form className="flex flex-wrap gap-2" method="get">
        <input
          name="q"
          defaultValue={sp.q ?? ""}
          placeholder="Search name or email…"
          className="h-9 min-w-[200px] rounded-md border px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={sp.status ?? ""}
          className="h-9 rounded-md border px-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="active">active</option>
          <option value="on_leave">on_leave</option>
          <option value="terminated">terminated</option>
        </select>
        <select
          name="type"
          defaultValue={sp.type ?? ""}
          className="h-9 rounded-md border px-2 text-sm"
        >
          <option value="">All types</option>
          <option value="salaried">salaried</option>
          <option value="hourly">hourly</option>
          <option value="production_based">production_based</option>
          <option value="per_diem">per_diem</option>
          <option value="contractor">contractor</option>
        </select>
        <Button type="submit" size="sm">
          Filter
        </Button>
      </form>

      {canWrite && <HrEmployeeCreateForm departments={departments} />}

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Department</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-3">
                  <Link
                    href={`/hr/employees/${e.id}`}
                    className="font-medium hover:underline"
                  >
                    {e.firstName} {e.lastName}
                  </Link>
                </td>
                <td className="p-3 text-muted-foreground">{e.jobTitle ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {e.department?.name ?? "—"}
                </td>
                <td className="p-3">{e.employmentType}</td>
                <td className="p-3">
                  <Badge variant="outline">{e.employmentStatus}</Badge>
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr>
                <td colSpan={5} className="p-8 text-center text-muted-foreground">
                  No employees match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
