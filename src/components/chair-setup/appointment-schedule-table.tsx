"use client";

type ChairRow = {
  id: string;
  name: string;
  number: number;
  colorCode: string;
};

export type AppointmentScheduleRow = {
  id: string;
  chairId: string;
  startTime: string;
  endTime: string;
  status: string;
  doctorId: string | null;
  doctorName: string | null;
  patientName: string;
};

type Props = {
  chairs: ChairRow[];
  appointments: AppointmentScheduleRow[];
};

function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString("en-AE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AppointmentScheduleTable({ chairs, appointments }: Props) {
  const byChair = new Map<string, AppointmentScheduleRow[]>();
  for (const appt of appointments) {
    byChair.set(appt.chairId, [...(byChair.get(appt.chairId) ?? []), appt]);
  }

  const chairsWithAppointments = chairs.filter((c) => (byChair.get(c.id)?.length ?? 0) > 0);

  if (chairsWithAppointments.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
        No appointments are booked against a chair today yet. This view fills in
        automatically as appointments are scheduled — it isn&apos;t something you need
        to enter manually.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-gray-50">
            <th className="px-4 py-3 text-left font-semibold">Chair</th>
            <th className="px-4 py-3 text-left font-semibold">Time</th>
            <th className="px-4 py-3 text-left font-semibold">Doctor</th>
            <th className="px-4 py-3 text-left font-semibold">Patient</th>
            <th className="px-4 py-3 text-left font-semibold">Status</th>
          </tr>
        </thead>
        <tbody>
          {chairsWithAppointments.map((chair) => {
            const rows = (byChair.get(chair.id) ?? []).slice().sort((a, b) =>
              a.startTime.localeCompare(b.startTime),
            );
            return rows.map((appt, i) => (
              <tr key={appt.id} className="border-b hover:bg-gray-50">
                <td className="px-4 py-3">
                  {i === 0 ? (
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: chair.colorCode }}
                      />
                      <span className="font-medium">{chair.name}</span>
                    </div>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground">
                  {timeLabel(appt.startTime)}–{timeLabel(appt.endTime)}
                </td>
                <td className="px-4 py-3">
                  {appt.doctorName ? (
                    <span className="text-xs font-medium">Dr. {appt.doctorName}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs">{appt.patientName}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs">
                    {appt.status}
                  </span>
                </td>
              </tr>
            ));
          })}
        </tbody>
      </table>
    </div>
  );
}
