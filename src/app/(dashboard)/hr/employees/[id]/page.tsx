export const runtime = "nodejs";

import Link from "next/link";
import { notFound } from "next/navigation";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { assertHrModuleEnabled } from "@/lib/hr/require-hr";
import { db } from "@/lib/db";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { isCredentialExpiringSoon } from "@/lib/hr/credential-expiry";
import { getEmployeeLeaveBalances } from "@/app/(dashboard)/features/hr/hr-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HrEmployeeDetailClient } from "./hr-employee-detail-client";

export default async function HrEmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await requireRouteAccess("hr", "read");
  assertHrModuleEnabled(ctx.tenant);

  const employee = await db.employee.findFirst({
    where: { id, tenantId: ctx.tenantId, deletedAt: null },
    include: {
      department: true,
      documents: {
        where: { deletedAt: null },
        orderBy: { uploadedAt: "desc" },
      },
      timeEntries: {
        where: { deletedAt: null },
        orderBy: { clockInAt: "desc" },
        take: 20,
      },
      leaveRequests: {
        where: { deletedAt: null },
        include: { leaveType: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      staffMember: { select: { id: true, email: true, role: true } },
    },
  });
  if (!employee) notFound();

  const canWrite = hasPermission(ctx.staffMember!.role, PERMISSIONS.hr.write);
  const balances = await getEmployeeLeaveBalances(employee.id);
  const leaveTypes = await db.leaveType.findMany({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link href="/hr">← Directory</Link>
        </Button>
        <h1 className="text-2xl font-bold">
          {employee.firstName} {employee.lastName}
        </h1>
        <p className="text-sm text-muted-foreground">
          {employee.jobTitle ?? "No title"} · {employee.employmentType} ·{" "}
          <Badge variant="outline">{employee.employmentStatus}</Badge>
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Department</CardTitle>
          </CardHeader>
          <CardContent>{employee.department?.name ?? "—"}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Hire date</CardTitle>
          </CardHeader>
          <CardContent>{employee.hireDate.toISOString().slice(0, 10)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Login link</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            {employee.staffMember
              ? `${employee.staffMember.email} (${employee.staffMember.role})`
              : "Not linked"}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {employee.documents.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 text-sm">
              {d.expiresAt && isCredentialExpiringSoon(d.expiresAt) && (
                <Badge variant="destructive">Expiring</Badge>
              )}
              <a href={d.fileUrl} target="_blank" rel="noreferrer" className="font-medium hover:underline">
                {d.title}
              </a>
              <span className="text-muted-foreground">
                {d.documentType}
                {d.expiresAt ? ` · expires ${d.expiresAt.toISOString().slice(0, 10)}` : ""}
              </span>
            </div>
          ))}
          {employee.documents.length === 0 && (
            <p className="text-sm text-muted-foreground">No documents yet.</p>
          )}
        </CardContent>
      </Card>

      <HrEmployeeDetailClient
        employeeId={employee.id}
        canWrite={canWrite}
        leaveTypes={leaveTypes.map((t) => ({ id: t.id, name: t.name }))}
        balances={balances}
        timeEntries={employee.timeEntries.map((t) => ({
          id: t.id,
          clockInAt: t.clockInAt.toISOString(),
          clockOutAt: t.clockOutAt?.toISOString() ?? null,
          source: t.source,
          status: t.status,
          breakMinutes: t.breakMinutes,
        }))}
        leaveRequests={employee.leaveRequests.map((r) => ({
          id: r.id,
          leaveTypeName: r.leaveType.name,
          startDate: r.startDate.toISOString().slice(0, 10),
          endDate: r.endDate.toISOString().slice(0, 10),
          dayCount: r.dayCount,
          status: r.status,
        }))}
      />
    </div>
  );
}
