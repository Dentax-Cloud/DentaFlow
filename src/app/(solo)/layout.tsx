export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant/context";
import { isSoloClinic } from "@/lib/clinic-type";

export default async function SoloLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  const clinicType = (ctx.tenant as { clinicType?: string | null }).clinicType
    ?? (ctx.tenant as { clinicMode?: string | null }).clinicMode;

  if (!isSoloClinic(clinicType)) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Solo Doctor</p>
            <h1 className="text-lg font-semibold">{ctx.tenant.name}</h1>
          </div>
          <nav className="flex gap-4 text-sm">
            <a href="/solo" className="hover:text-blue-600">Today</a>
            <a href="/solo/appointments" className="hover:text-blue-600">Appointments</a>
            <a href="/solo/patients" className="hover:text-blue-600">Patients</a>
            <a href="/solo/clinical" className="hover:text-blue-600">Clinical</a>
            <a href="/solo/billing" className="hover:text-blue-600">Billing</a>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl p-6">{children}</main>
    </div>
  );
}
