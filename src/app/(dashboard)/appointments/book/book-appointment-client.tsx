"use client";

import { useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Search } from "lucide-react";
import {
  getDoctorsWithAvailability,
  getSlotsForDoctor,
  bookAppointment,
} from "@/app/(dashboard)/features/appointments/appointment-booking-actions";
import type { DoctorAvailability, TimeSlot } from "@/lib/appointments/availability";

type Procedure = {
  id: string;
  code: string;
  name: string;
  durationMins: number;
  requiresPreAuth: boolean;
};

type Branch = { id: string; name: string };

type PatientResult = {
  id: string;
  firstName: string;
  lastName: string;
  patientId: string | null;
  patientNumber: string;
  phone: string | null;
  allergies: string[];
  insuranceProvider: string | null;
};

export default function BookAppointmentClient({
  procedures,
  branches,
}: {
  procedures: Procedure[];
  branches: Branch[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(1);

  const [patient, setPatient] = useState<PatientResult | null>(null);
  const [procedure, setProcedure] = useState<Procedure | null>(null);
  const [customDuration, setCustomDuration] = useState<number | null>(null);
  const [doctor, setDoctor] = useState<DoctorAvailability | null>(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [branchId, setBranchId] = useState(branches[0]?.id ?? "");
  const [notes, setNotes] = useState("");

  const [doctors, setDoctors] = useState<DoctorAvailability[]>([]);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [patientSearch, setPatientSearch] = useState("");
  const [patientResults, setPatientResults] = useState<PatientResult[]>([]);

  const durationMins = customDuration ?? procedure?.durationMins ?? 30;

  useEffect(() => {
    if (patientSearch.length < 2) {
      setPatientResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await fetch(
        `/api/patients/search?q=${encodeURIComponent(patientSearch)}`,
      );
      if (res.ok) {
        const data = (await res.json()) as { patients?: PatientResult[] };
        setPatientResults(data.patients ?? []);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [patientSearch]);

  useEffect(() => {
    if (!selectedDate || !durationMins) return;
    getDoctorsWithAvailability({
      date: selectedDate,
      durationMins,
      branchId: branchId || undefined,
    }).then(setDoctors);
  }, [selectedDate, durationMins, branchId]);

  useEffect(() => {
    if (!doctor || !selectedDate) return;
    getSlotsForDoctor({
      doctorId: doctor.doctorId,
      date: selectedDate,
      durationMins,
      branchId: branchId || undefined,
    }).then(setSlots);
  }, [doctor, selectedDate, durationMins, branchId]);

  async function handleBook() {
    if (!patient || !doctor || !selectedDate || !selectedTime) return;

    startTransition(async () => {
      const result = await bookAppointment({
        patientId: patient.id,
        doctorId: doctor.doctorId,
        date: selectedDate,
        startTime: selectedTime,
        durationMins,
        procedureId: procedure?.id,
        branchId: branchId || undefined,
        notes: notes || undefined,
        preAuthStatus: procedure?.requiresPreAuth
          ? "PENDING"
          : "NOT_REQUIRED",
      });

      if (!result.success) {
        toast.error(result.error ?? "Booking failed");
        return;
      }

      toast.success(
        `Appointment booked for ${patient.firstName} ${patient.lastName}`,
      );
      router.push("/appointments");
    });
  }

  const steps = [
    "Patient",
    "Procedure",
    "Doctor & Date",
    "Time",
    "Confirm",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {steps.map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                i + 1 < step
                  ? "bg-green-600 text-white"
                  : i + 1 === step
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-500"
              }`}
            >
              {i + 1 < step ? "✓" : i + 1}
            </div>
            <span
              className={`text-xs hidden sm:block ${
                i + 1 === step
                  ? "font-semibold text-blue-600"
                  : "text-muted-foreground"
              }`}
            >
              {s}
            </span>
            {i < steps.length - 1 && (
              <div
                className={`flex-1 h-px w-4 ${
                  i + 1 < step ? "bg-green-400" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {step === 1 && (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Select Patient</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={patientSearch}
              onChange={(e) => setPatientSearch(e.target.value)}
              placeholder="Search by name, phone, or patient ID..."
              className="w-full pl-9 pr-4 py-3 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {patientResults.length > 0 && (
            <div className="border rounded-lg overflow-hidden">
              {patientResults.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPatient(p);
                    setPatientSearch(`${p.firstName} ${p.lastName}`);
                    setPatientResults([]);
                  }}
                  className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-0 transition-colors"
                >
                  <p className="font-medium text-sm">
                    {p.firstName} {p.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {p.patientId ?? p.patientNumber} · {p.phone}
                    {p.allergies.length > 0 && (
                      <span className="text-red-600 ml-2">
                        ⚠ {p.allergies.join(", ")}
                      </span>
                    )}
                  </p>
                </button>
              ))}
            </div>
          )}

          {patient && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  {patient.firstName[0]}
                  {patient.lastName[0]}
                </div>
                <div>
                  <p className="font-semibold">
                    {patient.firstName} {patient.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {patient.patientId ?? patient.patientNumber}
                    {patient.insuranceProvider &&
                      ` · ${patient.insuranceProvider}`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setPatient(null);
                    setPatientSearch("");
                  }}
                  className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  Change
                </button>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!patient}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
          >
            Continue →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Select Procedure</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-80 overflow-y-auto">
            {procedures.map((proc) => (
              <button
                key={proc.id}
                type="button"
                onClick={() => setProcedure(proc)}
                className={`text-left p-3 rounded-xl border transition-colors ${
                  procedure?.id === proc.id
                    ? "border-blue-500 bg-blue-50"
                    : "hover:bg-gray-50"
                }`}
              >
                <p className="font-medium text-sm">{proc.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {proc.durationMins} min
                  {proc.requiresPreAuth && (
                    <span className="text-orange-600 ml-2">⚠ pre-auth</span>
                  )}
                </p>
              </button>
            ))}
          </div>

          {procedure && (
            <div className="flex items-center gap-3">
              <label className="text-sm text-muted-foreground">
                Duration (min):
              </label>
              <input
                type="number"
                min={5}
                step={5}
                value={customDuration ?? procedure.durationMins}
                onChange={(e) => setCustomDuration(Number(e.target.value))}
                className="w-24 rounded-lg border px-3 py-1.5 text-sm text-center"
              />
              {customDuration && (
                <button
                  type="button"
                  onClick={() => setCustomDuration(null)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Reset to default
                </button>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(1)}
              className="flex-1 py-3 border rounded-lg text-sm hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(3)}
              disabled={!procedure}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Select Doctor & Date</h2>

          {branches.length > 1 && (
            <div>
              <label className="text-sm font-medium">Branch</label>
              <select
                value={branchId}
                onChange={(e) => {
                  setBranchId(e.target.value);
                  setDoctor(null);
                  setSelectedTime("");
                }}
                className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm"
              >
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split("T")[0]}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setDoctor(null);
                setSelectedTime("");
              }}
              className="mt-1 w-full rounded-lg border px-3 py-2.5 text-sm"
            />
          </div>

          {selectedDate && (
            <div>
              <label className="text-sm font-medium">Select Doctor</label>
              <div className="mt-2 space-y-2">
                {doctors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Loading availability...
                  </p>
                ) : (
                  doctors.map((doc) => (
                    <button
                      key={doc.doctorId}
                      type="button"
                      onClick={() => {
                        setDoctor(doc);
                        setSelectedTime("");
                      }}
                      disabled={
                        !doc.isWorkingToday || doc.availableSlots === 0
                      }
                      className={`w-full text-left p-4 rounded-xl border transition-colors ${
                        doctor?.doctorId === doc.doctorId
                          ? "border-blue-500 bg-blue-50"
                          : !doc.isWorkingToday || doc.availableSlots === 0
                            ? "opacity-50 cursor-not-allowed bg-gray-50"
                            : "hover:bg-gray-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                            style={{
                              backgroundColor: doc.calendarColor,
                            }}
                          >
                            {doc.doctorName.split(" ")[1]?.[0] ?? "D"}
                          </div>
                          <div>
                            <p className="font-medium text-sm">
                              {doc.doctorName}
                            </p>
                            {doc.specialization && (
                              <p className="text-xs text-muted-foreground">
                                {doc.specialization}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          {!doc.isWorkingToday ? (
                            <span className="text-xs text-muted-foreground">
                              Not working
                            </span>
                          ) : doc.availableSlots === 0 ? (
                            <span className="text-xs text-red-600 font-medium">
                              Fully booked
                            </span>
                          ) : (
                            <div>
                              <p className="text-xs font-semibold text-green-600">
                                🟢 {doc.availableSlots} slots
                              </p>
                              {doc.nextSlot && (
                                <p className="text-xs text-muted-foreground">
                                  Next: {doc.nextSlot}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(2)}
              className="flex-1 py-3 border rounded-lg text-sm hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(4)}
              disabled={!doctor || !selectedDate}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Select Time</h2>
          <p className="text-sm text-muted-foreground">
            {doctor?.doctorName} · {selectedDate}
          </p>

          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No available slots for this date
            </p>
          ) : (
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
              {slots.map((slot) => (
                <button
                  key={slot.time}
                  type="button"
                  onClick={() =>
                    slot.available && setSelectedTime(slot.time)
                  }
                  disabled={!slot.available}
                  className={`py-2.5 px-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedTime === slot.time
                      ? "bg-blue-600 text-white"
                      : slot.available
                        ? "bg-gray-100 hover:bg-blue-100 hover:text-blue-700"
                        : "bg-gray-50 text-gray-300 cursor-not-allowed line-through"
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(3)}
              className="flex-1 py-3 border rounded-lg text-sm hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={() => setStep(5)}
              disabled={!selectedTime}
              className="flex-1 py-3 bg-blue-600 text-white rounded-lg font-medium disabled:opacity-50 hover:bg-blue-700 transition-colors"
            >
              Continue →
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="bg-white border rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Confirm Appointment</h2>

          <div className="bg-gray-50 rounded-xl p-4 space-y-3">
            {[
              {
                label: "Patient",
                value: `${patient?.firstName} ${patient?.lastName}`,
              },
              {
                label: "Procedure",
                value: procedure?.name ?? "General",
              },
              {
                label: "Duration",
                value: `${durationMins} minutes`,
              },
              {
                label: "Doctor",
                value: doctor?.doctorName,
              },
              {
                label: "Date",
                value: new Date(selectedDate + "T12:00:00").toLocaleDateString(
                  "en-AE",
                  {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  },
                ),
              },
              {
                label: "Time",
                value: selectedTime,
              },
              ...(branchId && branches.length > 1
                ? [
                    {
                      label: "Branch",
                      value:
                        branches.find((b) => b.id === branchId)?.name ??
                        branchId,
                    },
                  ]
                : []),
            ].map((item) => (
              <div
                key={item.label}
                className="flex justify-between text-sm"
              >
                <span className="text-muted-foreground">{item.label}</span>
                <span className="font-medium">{item.value}</span>
              </div>
            ))}
          </div>

          {procedure?.requiresPreAuth && (
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <p className="text-orange-700 text-sm font-medium">
                ⚠ Pre-authorization required
              </p>
              <p className="text-orange-600 text-xs mt-0.5">
                This procedure requires insurance pre-authorization. Please
                ensure it is obtained before the appointment.
              </p>
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special instructions or notes..."
              rows={3}
              className="mt-1 w-full rounded-lg border px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setStep(4)}
              className="flex-1 py-3 border rounded-lg text-sm hover:bg-gray-50"
            >
              ← Back
            </button>
            <button
              type="button"
              onClick={handleBook}
              disabled={isPending}
              className="flex-1 py-3 bg-green-600 text-white rounded-lg font-semibold disabled:opacity-50 hover:bg-green-700 transition-colors"
            >
              {isPending ? "Booking..." : "✓ Confirm Booking"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
