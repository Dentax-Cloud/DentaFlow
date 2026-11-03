export const runtime = "nodejs";

import { redirect } from "next/navigation";
import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant/context";
import { isSoloClinic } from "@/lib/clinic-type";

const NAV = [
  { href: "/solo", label: "Today" },
  { href: "/appointments", label: "Appointments" },
  { href: "/patients", label: "Patients" },
  { href: "/clinical", label: "Clinical" },
  { href: "/billing", label: "Billing" },
  { href: "/inventory", label: "Inventory" },
  { href: "/admin", label: "Practice" },
];

export default async function SoloLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  const clinicType =
    (ctx.tenant as { clinicType?: string | null }).clinicType ??
    (ctx.tenant as { clinicMode?: string | null }).clinicMode;

  if (!isSoloClinic(clinicType)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          <Link href="/solo" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              S
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">Solo Doctor</p>
              <h1 className="text-base font-semibold leading-tight text-slate-900">{ctx.tenant.name}</h1>
            </div>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl p-6">{children}</main>
    </div>
  );
}
