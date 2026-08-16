import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { requireStaffMemberRole } from "@/lib/rbac/staff-role";
import { db } from "@/lib/db";
import { isEncounterSpineEnabled } from "@/lib/encounter/feature-flag";
import { QuickScan } from "@/components/reception/quick-scan";
import { WalkInPanel } from "@/components/reception/walk-in-panel";
import { WaitingRoomList } from "@/components/reception/waiting-room-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

export const runtime = "nodejs";

export default async function ReceptionPage() {
  const ctx = await requireRouteAccess("appointments", "read");
  const role = requireStaffMemberRole(ctx);
  const spineEnabled = isEncounterSpineEnabled(ctx.tenant);
  const canWriteAppointments = hasPermission(role, PERMISSIONS.appointments.write);
  const canVerifyInsurance =
    spineEnabled && hasPermission(role, PERMISSIONS.insurance.write);

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const [appointments, waitingRoom] = await Promise.all([
    db.appointment.findMany({
      where: {
        tenantId: ctx.tenant.id,
        isBlock: false,
        startTime: { gte: start, lte: end },
        deletedAt: null,
      },
      include: {
        patient: { select: { firstName: true, lastName: true, patientId: true } },
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        chair: { select: { name: true } },
      },
      orderBy: { startTime: "asc" },
    }),
    db.appointment.findMany({
      where: {
        tenantId: ctx.tenant.id,
        isBlock: false,
        startTime: { gte: start, lte: end },
        status: "ARRIVED",
        deletedAt: null,
      },
      include: {
        patient: { select: { firstName: true, lastName: true, patientId: true } },
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
        chair: { select: { name: true } },
        encounters: {
          where: { closedAt: null },
          select: {
            id: true,
            insuranceVerifications: {
              select: { id: true },
              take: 1,
              orderBy: { createdAt: "desc" },
            },
          },
          take: 1,
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { updatedAt: "asc" },
    }),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Reception</h1>
          <p className="text-muted-foreground">
            Scan patient IDs for quick check-in, or add a same-day walk-in
            {spineEnabled
              ? " — verify insurance after check-in when the encounter spine is on"
              : ""}
          </p>
        </div>
      </div>

      {canWriteAppointments ? <WalkInPanel /> : null}

      {canWriteAppointments ? (
        <QuickScan spineEnabled={spineEnabled} canVerifyInsurance={canVerifyInsurance} />
      ) : null}

      <WaitingRoomList
        spineEnabled={spineEnabled}
        canVerifyInsurance={canVerifyInsurance}
        patients={waitingRoom.map((apt) => ({
          id: apt.id,
          patientName: `${apt.patient!.firstName} ${apt.patient!.lastName}`,
          patientIdLabel: apt.patient!.patientId ?? apt.appointmentRef ?? apt.id,
          chairName: apt.chair?.name ?? null,
          hasInsuranceVerification: Boolean(
            apt.encounters[0]?.insuranceVerifications[0]?.id,
          ),
        }))}
      />

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
                    {apt.patient!.firstName} {apt.patient!.lastName}
                  </div>
                  <div className="font-mono text-xs text-muted-foreground">
                    {apt.patient!.patientId ?? apt.appointmentRef}
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
