"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Calendar, ChevronRight } from "lucide-react";
import { AppointmentDrawer } from "@/components/appointments/appointment-drawer";

type Appointment = {
  id: string;
  startTime: string;
  endTime: string;
  status: string;
  notes: string | null;
  patient: {
    id: string;
    firstName: string;
    lastName: string;
    patientId: string | null;
    patientNumber: string | null;
    phone: string | null;
    allergies: string[] | null;
    bloodGroup: string | null;
    insuranceProvider: string | null;
    insuranceNetwork: string | null;
    insuranceCoPayPercent: number | null;
  };
  chair: { id: string; name: string } | null;
  branch: { name: string } | null;
};

const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "border-l-gray-300 bg-gray-50",
  CONFIRMED: "border-l-blue-400 bg-blue-50",
  ARRIVED: "border-l-yellow-400 bg-yellow-50",
  IN_CHAIR: "border-l-purple-500 bg-purple-50",
  COMPLETED: "border-l-green-400 bg-green-50",
  INVOICED: "border-l-emerald-400 bg-emerald-50",
};

const STATUS_BADGES: Record<string, string> = {
  SCHEDULED: "bg-gray-100 text-gray-600",
  CONFIRMED: "bg-blue-100 text-blue-700",
  ARRIVED: "bg-yellow-100 text-yellow-700",
  IN_CHAIR: "bg-purple-100 text-purple-700",
  COMPLETED: "bg-green-100 text-green-700",
  INVOICED: "bg-emerald-100 text-emerald-700",
};

export default function DoctorDashboardClient({
  doctorName,
  role,
  appointments,
  unreadCount,
  totalThisWeek,
  today,
}: {
  doctorName: string;
  role: string;
  appointments: Appointment[];
  unreadCount: number;
  totalThisWeek: number;
  today: string;
}) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const todayDate = new Date(today);
  const greeting = (() => {
    const h = todayDate.getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  const todayFormatted = todayDate.toLocaleDateString("en-AE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const arrivedCount = appointments.filter((a) => a.status === "ARRIVED").length;
  const inChairCount = appointments.filter((a) => a.status === "IN_CHAIR").length;
  const completedCount = appointments.filter((a) => a.status === "COMPLETED").length;

  const displayName =
    doctorName.split(" ").slice(1).join(" ") || doctorName;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 p-6 text-white">
        <p className="text-sm text-blue-100">{greeting}</p>
        <h1 className="mt-1 text-2xl font-bold">Dr. {displayName}</h1>
        <p className="mt-1 text-sm text-blue-100">
          {todayFormatted} · {role}
        </p>

        <div className="mt-5 grid grid-cols-4 gap-3">
          {[
            { label: "Today", value: appointments.length, icon: "📅" },
            { label: "Arrived", value: arrivedCount, icon: "🔔" },
            { label: "In chair", value: inChairCount, icon: "🪑" },
            { label: "Done", value: completedCount, icon: "✓" },
          ].map((stat) => (
            <div
              key={stat.label}
              className="rounded-xl bg-white/15 p-3 text-center"
            >
              <p className="text-xl">{stat.icon}</p>
              <p className="mt-1 text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-blue-100">{stat.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-4 text-sm text-blue-100">
          <span>This week: {totalThisWeek}</span>
          {unreadCount > 0 && (
            <span>Notifications: {unreadCount}</span>
          )}
        </div>
      </div>

      {arrivedCount > 0 && (
        <div className="flex animate-pulse items-center gap-3 rounded-xl border border-yellow-300 bg-yellow-50 p-4">
          <span className="text-2xl">🔔</span>
          <div>
            <p className="font-semibold text-yellow-800">
              {arrivedCount} patient{arrivedCount !== 1 ? "s" : ""} waiting
            </p>
            <p className="text-sm text-yellow-700">
              {appointments
                .filter((a) => a.status === "ARRIVED")
                .map((a) => `${a.patient.firstName} ${a.patient.lastName}`)
                .join(", ")}
            </p>
          </div>
        </div>
      )}

      <div>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Today&apos;s Schedule</h2>
          <button
            onClick={() => router.push("/appointments")}
            className="flex items-center gap-1 text-sm text-blue-600 hover:underline"
          >
            Full calendar
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {appointments.length === 0 ? (
          <div className="rounded-xl border py-12 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="font-medium">No appointments today</p>
            <p className="mt-1 text-sm">
              Enjoy your free day or check the calendar
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {appointments.map((appt) => (
              <div
                key={appt.id}
                className={`rounded-xl border border-l-4 p-4 transition-shadow hover:shadow-sm ${
                  STATUS_STYLES[appt.status] ?? "border-l-gray-200 bg-white"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex flex-1 items-start gap-3">
                    <div className="w-14 flex-shrink-0 text-center">
                      <p className="text-sm font-bold">
                        {new Date(appt.startTime).toLocaleTimeString("en-AE", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {Math.round(
                          (new Date(appt.endTime).getTime() -
                            new Date(appt.startTime).getTime()) /
                            60000,
                        )}{" "}
                        min
                      </p>
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">
                        {appt.patient.firstName} {appt.patient.lastName}
                      </p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {appt.patient.patientId ?? appt.patient.patientNumber}
                      </p>

                      <div className="mt-1 flex flex-wrap gap-2">
                        {appt.chair && (
                          <span className="text-xs text-muted-foreground">
                            🪑 {appt.chair.name}
                          </span>
                        )}
                        {appt.patient.insuranceProvider && (
                          <span className="text-xs text-muted-foreground">
                            🏥 {appt.patient.insuranceProvider}
                            {appt.patient.insuranceCoPayPercent != null &&
                              ` · ${appt.patient.insuranceCoPayPercent}%`}
                          </span>
                        )}
                      </div>

                      {appt.patient.allergies &&
                        appt.patient.allergies.length > 0 && (
                          <div className="mt-1.5 flex items-center gap-1 text-xs font-medium text-red-600">
                            <span>⚠</span>
                            <span>
                              Allergy:{" "}
                              {appt.patient.allergies.slice(0, 2).join(", ")}
                            </span>
                          </div>
                        )}

                      {appt.notes && (
                        <p className="mt-1 truncate text-xs italic text-muted-foreground">
                          📝 {appt.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-shrink-0 flex-col items-end gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        STATUS_BADGES[appt.status] ??
                        "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {appt.status.replace("_", " ")}
                    </span>

                    <div className="flex gap-1">
                      <button
                        onClick={() => setSelectedId(appt.id)}
                        className="rounded-lg border px-2.5 py-1.5 text-xs transition-colors hover:bg-white"
                      >
                        View
                      </button>
                      {["CONFIRMED", "ARRIVED", "IN_CHAIR"].includes(
                        appt.status,
                      ) && (
                        <button
                          onClick={() =>
                            router.push(
                              `/clinical/chairside?patientId=${appt.patient.id}&appointmentId=${appt.id}`,
                            )
                          }
                          className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs text-white transition-colors hover:bg-blue-700"
                        >
                          Chairside
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AppointmentDrawer
        appointmentId={selectedId}
        onClose={() => setSelectedId(null)}
      />
    </div>
  );
}
