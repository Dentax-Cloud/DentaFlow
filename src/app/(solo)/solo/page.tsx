import Link from "next/link";
import { getTenantContext } from "@/lib/tenant/context";
import { ClinicTypeToggle } from "@/components/layout/clinic-type-toggle";
import { normalizeClinicType } from "@/lib/clinic-type";

export default async function SoloTodayPage() {
  const ctx = await getTenantContext();
  const clinicType = normalizeClinicType(
    (ctx?.tenant as { clinicType?: string | null } | undefined)?.clinicType ??
      (ctx?.tenant as { clinicMode?: string | null } | undefined)?.clinicMode,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Today</h2>
          <p className="text-sm text-muted-foreground">Your solo clinic action hub</p>
        </div>
        <ClinicTypeToggle current={clinicType} />
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link href="/appointments/book" className="rounded-xl border bg-white p-6 shadow-sm hover:border-blue-300">
          <p className="text-lg font-semibold">Book Appointment</p>
          <p className="mt-1 text-sm text-muted-foreground">Schedule a patient visit</p>
        </Link>
        <Link href="/clinical" className="rounded-xl border bg-white p-6 shadow-sm hover:border-blue-300">
          <p className="text-lg font-semibold">Start Visit</p>
          <p className="mt-1 text-sm text-muted-foreground">Open clinical workspace</p>
        </Link>
        <Link href="/billing" className="rounded-xl border bg-white p-6 shadow-sm hover:border-blue-300">
          <p className="text-lg font-semibold">Invoice</p>
          <p className="mt-1 text-sm text-muted-foreground">Generate and collect payment</p>
        </Link>
      </div>

      <div className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold">Today&apos;s schedule</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          No appointments yet. Book the first patient of the day.
        </p>
      </div>
    </div>
  );
}
