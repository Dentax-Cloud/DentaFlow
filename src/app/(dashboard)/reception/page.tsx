import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { QuickScan } from "@/components/reception/quick-scan";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";

export default async function ReceptionPage() {
  const ctx = await requireRouteAccess("appointments", "read");

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const appointments = await db.appointment.findMany({
    where: {
      tenantId: ctx.tenant.id,
      startTime: { gte: start, lte: end },
      deletedAt: null,
    },
    include: {
      patient: { select: { firstName: true, lastName: true, patientId: true } },
      doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { startTime: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Reception</h1>
        <p className="text-muted-foreground">Scan patient IDs for quick check-in</p>
      </div>

      <QuickScan />

      <Card>
        <CardHeader>
          <CardTitle>Today&apos;s schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {appointments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No appointments today</p>
          ) : (
            appointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div>
                  <div className="font-medium">
                    {apt.patient.firstName} {apt.patient.lastName}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {apt.patient.patientId ?? apt.appointmentRef}
                  </div>
                </div>
                <div className="text-right text-sm">
                  <div>{formatDate(apt.startTime)}</div>
                  <div className="text-muted-foreground">
                    {apt.doctor?.user
                      ? `Dr. ${apt.doctor.user.firstName ?? ""} ${apt.doctor.user.lastName ?? ""}`.trim()
                      : "Unassigned"}
                  </div>
                  <Badge variant="outline" className="mt-1">
                    {apt.status}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
