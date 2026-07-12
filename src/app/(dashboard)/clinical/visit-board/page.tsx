import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { requireStaffMemberRole } from "@/lib/rbac/staff-role";
import { UserRole } from "@prisma/client";
import { getVisitBoardAppointments } from "@/app/(dashboard)/features/procedure-lines/queries";
import { VisitBoardClient } from "./visit-board-client";

export const runtime = "nodejs";

export default async function VisitBoardPage({
  searchParams,
}: {
  searchParams: Promise<{ appointmentId?: string }>;
}) {
  const ctx = await requireRouteAccess("clinical_schedule", "read");
  const { appointmentId } = await searchParams;
  const role = requireStaffMemberRole(ctx);

  const appointments = await getVisitBoardAppointments(
    ctx.tenant.id,
    ctx.tenant.timezone,
  );

  const canForceClose = role === UserRole.ADMIN || role === UserRole.OWNER;

  return (
    <div className="p-4 md:p-6">
      <VisitBoardClient
        appointments={appointments}
        timezone={ctx.tenant.timezone}
        canForceClose={canForceClose}
        highlightAppointmentId={appointmentId ?? null}
      />
    </div>
  );
}
