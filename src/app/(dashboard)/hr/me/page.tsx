export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenant/context";
import { assertHrModuleEnabled } from "@/lib/hr/require-hr";
import { db } from "@/lib/db";
import { getEmployeeLeaveBalances } from "@/app/(dashboard)/features/hr/hr-actions";
import { isCredentialExpiringSoon } from "@/lib/hr/credential-expiry";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HrMeClient } from "./hr-me-client";

export default async function HrMePage() {
  const ctx = await requireTenantContext();
  assertHrModuleEnabled(ctx.tenant);
  if (!ctx.staffMember?.id) redirect("/dashboard");

  const employee = await db.employee.findFirst({
    where: {
      tenantId: ctx.tenantId,
      staffMemberId: ctx.staffMember.id,
      deletedAt: null,
    },
    include: {
      department: true,
      documents: { where: { deletedAt: null }, orderBy: { uploadedAt: "desc" } },
      timeEntries: {
        where: { deletedAt: null },
        orderBy: { clockInAt: "desc" },
        take: 15,
      },
      leaveRequests: {
        where: { deletedAt: null },
        include: { leaveType: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 15,
      },
    },
  });
  if (!employee) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">My HR</h1>
        <p className="text-muted-foreground">
          No employee record is linked to your login. Ask an admin to create an HR
          employee and link your StaffMember id.
        </p>
      </div>
    );
  }

  const [balances, leaveTypes] = await Promise.all([
    getEmployeeLeaveBalances(employee.id),
    db.leaveType.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My HR</h1>
        <p className="text-sm text-muted-foreground">
          {employee.firstName} {employee.lastName}
          {employee.jobTitle ? ` · ${employee.jobTitle}` : ""}
          {employee.department ? ` · ${employee.department.name}` : ""}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My documents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {employee.documents.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2">
              {d.expiresAt && isCredentialExpiringSoon(d.expiresAt) && (
                <Badge variant="destructive">Expiring</Badge>
              )}
              <a href={d.fileUrl} className="font-medium hover:underline" target="_blank" rel="noreferrer">
                {d.title}
              </a>
              <span className="text-muted-foreground">{d.documentType}</span>
            </div>
          ))}
          {employee.documents.length === 0 && (
            <p className="text-muted-foreground">No documents.</p>
          )}
        </CardContent>
      </Card>

      <HrMeClient
        employeeId={employee.id}
        leaveTypes={leaveTypes.map((t) => ({ id: t.id, name: t.name }))}
        balances={balances}
        timeEntries={employee.timeEntries.map((t) => ({
          id: t.id,
          clockInAt: t.clockInAt.toISOString(),
          clockOutAt: t.clockOutAt?.toISOString() ?? null,
          status: t.status,
          source: t.source,
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
