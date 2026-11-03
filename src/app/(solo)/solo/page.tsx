import Link from "next/link";
import { getTenantContext } from "@/lib/tenant/context";
import { ClinicTypeToggle } from "@/components/layout/clinic-type-toggle";
import { normalizeClinicType } from "@/lib/clinic-type";

const ACTIONS = [
  {
    href: "/appointments/book",
    title: "Book Appointment",
    desc: "Schedule a patient visit",
    accent: "from-blue-500 to-cyan-500",
  },
  {
    href: "/patients",
    title: "Patients",
    desc: "Search and open records",
    accent: "from-emerald-500 to-teal-500",
  },
  {
    href: "/clinical",
    title: "Start Visit",
    desc: "Open the clinical workspace",
    accent: "from-violet-500 to-indigo-500",
  },
  {
    href: "/billing",
    title: "Invoice",
    desc: "Generate and collect payment",
    accent: "from-amber-500 to-orange-500",
  },
  {
    href: "/clinical/chair-setup",
    title: "Chair & Tray",
    desc: "Prepare the operatory",
    accent: "from-rose-500 to-pink-500",
  },
  {
    href: "/inventory",
    title: "Inventory",
    desc: "Stock and supplies",
    accent: "from-slate-500 to-slate-700",
  },
];

export default async function SoloTodayPage() {
  const ctx = await getTenantContext();
  const clinicType = normalizeClinicType(
    (ctx?.tenant as { clinicType?: string | null } | undefined)?.clinicType ??
      (ctx?.tenant as { clinicMode?: string | null } | undefined)?.clinicMode,
  );
  const clinicName = ctx?.tenant.name ?? "Your clinic";

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-600">Good day</p>
          <h2 className="text-3xl font-bold tracking-tight text-slate-900">Today at {clinicName}</h2>
          <p className="mt-1 text-sm text-slate-500">Your solo clinic action hub — book, treat, and bill from one place.</p>
        </div>
        <ClinicTypeToggle current={clinicType} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ACTIONS.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="group rounded-2xl border bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
          >
            <div className={`mb-4 h-1.5 w-10 rounded-full bg-gradient-to-r ${action.accent}`} />
            <p className="text-lg font-semibold text-slate-900">{action.title}</p>
            <p className="mt-1 text-sm text-slate-500">{action.desc}</p>
            <p className="mt-3 text-sm font-medium text-blue-600 opacity-0 transition group-hover:opacity-100">
              Open →
            </p>
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border bg-white p-6 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-slate-900">Today's schedule</h3>
            <Link href="/appointments" className="text-sm font-medium text-blue-600 hover:underline">
              View calendar
            </Link>
          </div>
          <div className="mt-4 rounded-xl border border-dashed bg-slate-50 p-6 text-center">
            <p className="text-sm text-slate-500">No appointments yet.</p>
            <Link
              href="/appointments/book"
              className="mt-3 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Book the first patient
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6">
          <h3 className="text-lg font-semibold text-slate-900">Quick links</h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li><Link href="/patients" className="text-slate-700 hover:text-blue-600">Add or find a patient</Link></li>
            <li><Link href="/appointments/book" className="text-slate-700 hover:text-blue-600">Book an appointment</Link></li>
            <li><Link href="/clinical/chair-setup" className="text-slate-700 hover:text-blue-600">Prepare chair and tray</Link></li>
            <li><Link href="/billing" className="text-slate-700 hover:text-blue-600">Create an invoice</Link></li>
            <li><Link href="/admin" className="text-slate-700 hover:text-blue-600">Clinic settings</Link></li>
          </ul>
        </div>
      </div>
    </div>
  );
}
