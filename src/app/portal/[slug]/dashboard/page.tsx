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

export default async function PortalDashboard({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requirePortalContext(slug);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [upcomingAppointments, pendingInvoices, pendingPlans] = await Promise.all([
    db.appointment.findMany({
      where: {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        startTime: { gte: today },
        status: { notIn: ["CANCELED", "NO_SHOW"] },
      },
      include: {
        doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { startTime: "asc" },
      take: 3,
    }),
    db.invoice.findMany({
      where: {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        status: { in: ["SENT", "OVERDUE", "PARTIAL"] },
      },
      orderBy: { createdAt: "desc" },
      take: 3,
    }),
    db.treatmentPlan.findMany({
      where: {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        status: { in: ["PROPOSED", "DRAFT"] },
      },
      take: 5,
    }),
  ]);

  return (
    <div className="space-y-6">
      <PortalDesktopNav slug={slug} />

      <div className="rounded-2xl bg-blue-600 p-6 text-white">
        <p className="text-sm text-blue-100">Welcome back</p>
        <h1 className="mt-1 text-2xl font-bold">
          {ctx.patient.firstName} {ctx.patient.lastName}
        </h1>
        <p className="mt-1 font-mono text-sm text-blue-100">
          Patient ID: {ctx.patient.patientId ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { href: "appointments", icon: "📅", label: "Appointments", badge: upcomingAppointments.length },
          { href: "invoices", icon: "🧾", label: "Invoices", badge: pendingInvoices.length },
          { href: "consent", icon: "📋", label: "Forms", badge: pendingPlans.length },
          {
            href: "book",
            icon: "➕",
            label: "Book visit",
            badge: 0,
            highlight: ctx.tenant.bookingEnabled,
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={`/portal/${slug}/${item.href}`}
            className={`block rounded-xl border p-4 text-center transition-all hover:shadow-md ${
              item.highlight ? "border-green-200 bg-green-50" : "border-gray-200 bg-white"
            }`}
          >
            <p className="text-2xl">{item.icon}</p>
            <p className="mt-1 text-xs font-medium">{item.label}</p>
            {item.badge > 0 && (
              <span className="mt-1 inline-block rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </Link>
        ))}
      </div>

      {upcomingAppointments.length > 0 && (
        <div className="rounded-xl border bg-white p-4">
          <h2 className="mb-3 font-semibold">Upcoming appointments</h2>
          <div className="space-y-3">
            {upcomingAppointments.map((apt) => (
              <div
                key={apt.id}
                className="flex items-center justify-between rounded-lg bg-blue-50 p-3"
              >
                <div>
                  <p className="text-sm font-medium">
                    {new Date(apt.startTime).toLocaleDateString("en-AE", {
                      weekday: "short",
                      day: "numeric",
                      month: "short",
                    })}
                    {" at "}
                    {new Date(apt.startTime).toLocaleTimeString("en-AE", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </p>
                  {formatDoctorName(apt.doctor) && (
                    <p className="text-xs text-muted-foreground">{formatDoctorName(apt.doctor)}</p>
                  )}
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-medium ${
                    apt.status === "CONFIRMED"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {apt.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {pendingPlans.length > 0 && (
        <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
          <p className="font-medium text-orange-800">
            ⚠ {pendingPlans.length} treatment plan{pendingPlans.length > 1 ? "s" : ""} awaiting
            review
          </p>
          <Link
            href={`/portal/${slug}/consent`}
            className="mt-1 block text-sm text-orange-700 underline"
          >
            Review →
          </Link>
        </div>
      )}

      <PortalNav slug={slug} />
    </div>
  );
}
