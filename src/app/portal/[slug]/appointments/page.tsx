export const runtime = "nodejs";

import { requirePortalContext } from "@/lib/portal/portal-context";
import { db } from "@/lib/db";
import Link from "next/link";
import { PortalNav, PortalDesktopNav } from "@/components/portal/portal-nav";

function formatDoctorName(
  doctor: { user: { firstName: string | null; lastName: string | null } } | null,
) {
  if (!doctor?.user) return null;
  return `Dr. ${doctor.user.firstName ?? ""} ${doctor.user.lastName ?? ""}`.trim();
}

export default async function PortalAppointmentsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requirePortalContext(slug);

  const appointments = await db.appointment.findMany({
    where: {
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
    },
    include: {
      doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
      branch: { select: { name: true } },
    },
    orderBy: { startTime: "desc" },
    take: 50,
  });

  const now = new Date();
  const upcoming = appointments.filter(
    (a) => new Date(a.startTime) >= now && !["CANCELED", "NO_SHOW"].includes(a.status),
  );
  const past = appointments.filter(
    (a) =>
      new Date(a.startTime) < now ||
      ["COMPLETED", "CANCELED", "NO_SHOW"].includes(a.status),
  );

  function AppointmentCard({ apt }: { apt: (typeof appointments)[0] }) {
    const date = new Date(apt.startTime);
    const isPast = date < now;

    return (
      <div
        className={`rounded-xl border p-4 ${
          isPast ? "border-gray-200 bg-gray-50" : "border-blue-200 bg-white"
        }`}
      >
        <div className="flex items-start justify-between">
          <div>
            <p className="font-semibold">
              {date.toLocaleDateString("en-AE", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </p>
            <p className="text-sm text-muted-foreground">
              {date.toLocaleTimeString("en-AE", { hour: "2-digit", minute: "2-digit" })}
              {formatDoctorName(apt.doctor) && ` · ${formatDoctorName(apt.doctor)}`}
            </p>
            {apt.branch && (
              <p className="mt-0.5 text-xs text-muted-foreground">📍 {apt.branch.name}</p>
            )}
            {apt.notes && (
              <p className="mt-1 text-xs italic text-muted-foreground">{apt.notes}</p>
            )}
          </div>
          <span
            className={`flex-shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
              apt.status === "COMPLETED"
                ? "bg-green-100 text-green-700"
                : apt.status === "CONFIRMED"
                  ? "bg-blue-100 text-blue-700"
                  : apt.status === "CANCELED"
                    ? "bg-gray-100 text-gray-600"
                    : apt.status === "NO_SHOW"
                      ? "bg-red-100 text-red-700"
                      : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {apt.status.replace("_", " ")}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalDesktopNav slug={slug} />
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">My Appointments</h1>
        {ctx.tenant.bookingEnabled && (
          <Link
            href={`/portal/${slug}/book`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Book appointment
          </Link>
        )}
      </div>

      {upcoming.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Upcoming ({upcoming.length})
          </h2>
          <div className="space-y-3">
            {upcoming.map((apt) => (
              <AppointmentCard key={apt.id} apt={apt} />
            ))}
          </div>
        </div>
      )}

      {past.length > 0 && (
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Past visits ({past.length})
          </h2>
          <div className="space-y-3">
            {past.slice(0, 10).map((apt) => (
              <AppointmentCard key={apt.id} apt={apt} />
            ))}
          </div>
        </div>
      )}

      {appointments.length === 0 && (
        <div className="py-12 text-center text-muted-foreground">
          <p className="mb-3 text-4xl">📅</p>
          <p className="font-medium">No appointments yet</p>
          {ctx.tenant.bookingEnabled && (
            <Link
              href={`/portal/${slug}/book`}
              className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm text-white"
            >
              Book your first appointment
            </Link>
          )}
        </div>
      )}

      <PortalNav slug={slug} />
    </div>
  );
}
