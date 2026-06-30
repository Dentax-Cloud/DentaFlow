export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import BookAppointmentClient from "./book-appointment-client";

export default async function BookAppointmentPage() {
  const ctx = await requireRouteAccess("appointments", "write");

  const [procedures, branches] = await Promise.all([
    db.procedureCatalog.findMany({
      where: {
        tenantId: ctx.tenantId,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        duration: true,
        requiresPreAuth: true,
      },
      orderBy: { name: "asc" },
    }),
    db.branch.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Book Appointment</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Schedule an appointment for a patient
        </p>
      </div>

      <BookAppointmentClient
        procedures={procedures.map((p) => ({
          id: p.id,
          code: p.code,
          name: p.name,
          durationMins: p.duration ?? 30,
          requiresPreAuth: p.requiresPreAuth,
        }))}
        branches={branches}
      />
    </div>
  );
}
