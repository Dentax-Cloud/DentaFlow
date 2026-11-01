import Link from "next/link";

export default function SoloTodayPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Today</h2>
        <p className="text-sm text-muted-foreground">Your solo clinic action hub</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Link
          href="/appointments/book"
          className="rounded-xl border bg-white p-6 shadow-sm hover:border-blue-300"
        >
          <p className="text-lg font-semibold">Book Appointment</p>
          <p className="mt-1 text-sm text-muted-foreground">Schedule a patient visit</p>
        </Link>
        <Link
          href="/clinical"
          className="rounded-xl border bg-white p-6 shadow-sm hover:border-blue-300"
        >
          <p className="text-lg font-semibold">Start Visit</p>
          <p className="mt-1 text-sm text-muted-foreground">Open clinical workspace</p>
        </Link>
        <Link
          href="/billing"
          className="rounded-xl border bg-white p-6 shadow-sm hover:border-blue-300"
        >
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
