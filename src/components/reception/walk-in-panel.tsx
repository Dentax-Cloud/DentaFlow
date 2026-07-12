"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import {
  bookWalkInAppointment,
  getDoctorsWithAvailability,
  getNextAvailableSlot,
  getSlotsForDoctor,
} from "@/app/(dashboard)/features/appointments/appointment-booking-actions";
import type {
  DoctorAvailability,
  NextAvailableSlot,
  TimeSlot,
} from "@/lib/appointments/availability";
import {
  PatientSearchPicker,
  type PatientSearchResult,
} from "@/components/patients/patient-search-picker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Mode = "soonest" | "pick-doctor";

export function WalkInPanel() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [patient, setPatient] = useState<PatientSearchResult | null>(null);
  const [nextSlot, setNextSlot] = useState<NextAvailableSlot | null>(null);
  const [loadingSlot, setLoadingSlot] = useState(false);
  const [mode, setMode] = useState<Mode>("soonest");
  const [doctors, setDoctors] = useState<DoctorAvailability[]>([]);
  const [doctor, setDoctor] = useState<DoctorAvailability | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedTime, setSelectedTime] = useState("");
  const [notes, setNotes] = useState("");
  const durationMins = 30;
  const today = new Date().toISOString().split("T")[0]!;

  useEffect(() => {
    if (!open || !patient) return;
    setLoadingSlot(true);
    getNextAvailableSlot({ date: today, durationMins })
      .then(setNextSlot)
      .catch(() => setNextSlot(null))
      .finally(() => setLoadingSlot(false));
  }, [open, patient, today]);

  useEffect(() => {
    if (mode !== "pick-doctor" || !patient) return;
    getDoctorsWithAvailability({ date: today, durationMins }).then(setDoctors);
  }, [mode, patient, today]);

  useEffect(() => {
    if (!doctor) {
      setSlots([]);
      return;
    }
    getSlotsForDoctor({
      doctorId: doctor.doctorId,
      date: today,
      durationMins,
    }).then(setSlots);
  }, [doctor, today]);

  function reset() {
    setPatient(null);
    setNextSlot(null);
    setMode("soonest");
    setDoctor(null);
    setSlots([]);
    setSelectedTime("");
    setNotes("");
  }

  function handleBook() {
    if (!patient) return;

    startTransition(async () => {
      const result =
        mode === "soonest"
          ? await bookWalkInAppointment({
              patientId: patient.id,
              durationMins,
              notes: notes || undefined,
              doctorId: nextSlot?.doctorId,
              date: nextSlot?.date,
              startTime: nextSlot?.time,
              chairId: nextSlot?.chairId ?? undefined,
            })
          : await bookWalkInAppointment({
              patientId: patient.id,
              durationMins,
              notes: notes || undefined,
              doctorId: doctor?.doctorId,
              date: today,
              startTime: selectedTime,
            });

      if (!result.success) {
        toast.error(result.error ?? "Walk-in booking failed");
        return;
      }

      toast.success(
        `Walk-in booked: ${patient.firstName} ${patient.lastName}` +
          (result.slot
            ? ` · ${result.slot.doctorName} at ${result.slot.time}`
            : ""),
      );
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  const canBookSoonest = Boolean(patient && nextSlot);
  const canBookPicked = Boolean(patient && doctor && selectedTime);

  if (!open) {
    return (
      <Button type="button" onClick={() => setOpen(true)} className="gap-2">
        <UserPlus className="h-4 w-4" />
        Add walk-in
      </Button>
    );
  }

  return (
    <Card className="border-teal-200 bg-teal-50/30">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>Add walk-in</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Books the soonest free slot — never displaces existing appointments
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setOpen(false);
            reset();
          }}
        >
          Cancel
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <PatientSearchPicker
          selected={patient}
          onSelect={setPatient}
          onClear={() => {
            setPatient(null);
            setNextSlot(null);
            setDoctor(null);
            setSelectedTime("");
          }}
        />

        {patient && (
          <>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode("soonest")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  mode === "soonest"
                    ? "border-teal-500 bg-teal-50 text-teal-800"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                Soonest available (any doctor)
              </button>
              <button
                type="button"
                onClick={() => setMode("pick-doctor")}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium ${
                  mode === "pick-doctor"
                    ? "border-teal-500 bg-teal-50 text-teal-800"
                    : "bg-white hover:bg-gray-50"
                }`}
              >
                Pick a specific doctor
              </button>
            </div>

            {mode === "soonest" && (
              <div className="rounded-xl border bg-white p-4 space-y-2">
                {loadingSlot ? (
                  <p className="text-sm text-muted-foreground">
                    Finding next available slot…
                  </p>
                ) : nextSlot ? (
                  <>
                    <p className="text-sm font-semibold text-teal-800">
                      Next available: {nextSlot.time} · {nextSlot.doctorName}
                    </p>
                    {nextSlot.chairName && (
                      <p className="text-xs text-muted-foreground">
                        Suggested chair: {nextSlot.chairName}
                      </p>
                    )}
                    {nextSlot.specialization && (
                      <p className="text-xs text-muted-foreground">
                        {nextSlot.specialization}
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-red-600">
                      No free slots today across any doctor.
                    </p>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link href="/appointments/book">Open booking wizard</Link>
                    </Button>
                  </div>
                )}
              </div>
            )}

            {mode === "pick-doctor" && (
              <div className="space-y-3">
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {doctors.map((doc) => (
                    <button
                      key={doc.doctorId}
                      type="button"
                      disabled={
                        !doc.hasScheduleConfigured ||
                        !doc.isWorkingToday ||
                        doc.availableSlots === 0
                      }
                      onClick={() => {
                        setDoctor(doc);
                        setSelectedTime("");
                      }}
                      className={`w-full text-left rounded-lg border px-3 py-2 text-sm ${
                        doctor?.doctorId === doc.doctorId
                          ? "border-teal-500 bg-teal-50"
                          : "bg-white hover:bg-gray-50 disabled:opacity-50"
                      }`}
                    >
                      <span className="font-medium">{doc.doctorName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {doc.nextSlot
                          ? `Next: ${doc.nextSlot}`
                          : doc.availableSlots === 0
                            ? "Fully booked"
                            : "No slots"}
                      </span>
                    </button>
                  ))}
                </div>
                {doctor && (
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {slots
                      .filter((s) => s.available)
                      .map((slot) => (
                        <button
                          key={slot.time}
                          type="button"
                          onClick={() => setSelectedTime(slot.time)}
                          className={`rounded-lg py-2 text-sm font-medium ${
                            selectedTime === slot.time
                              ? "bg-teal-600 text-white"
                              : "bg-white border hover:bg-teal-50"
                          }`}
                        >
                          {slot.time}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-medium">Notes (optional)</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm resize-none"
                placeholder="Reason for walk-in…"
              />
            </div>

            <Button
              type="button"
              onClick={handleBook}
              disabled={
                isPending ||
                (mode === "soonest" ? !canBookSoonest : !canBookPicked)
              }
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {isPending ? "Booking…" : "Confirm walk-in"}
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
