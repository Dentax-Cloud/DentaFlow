"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  getBookingServices,
  getBookingDoctors,
  getSlotsForDate,
  submitBookingRequest,
} from "./booking-actions";
import { PortalNav, PortalDesktopNav } from "@/components/portal/portal-nav";
import { Bilingual } from "@/components/i18n/bilingual-text";
import { translateUi } from "@/lib/i18n/translations";
import { normalizeSecondaryLanguage } from "@/lib/i18n/secondary-languages";

type Service = {
  id: string;
  name: string;
  durationMins: number;
  sellingPrice: unknown;
  category: string | null;
};

type Doctor = {
  id: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
};

type Slot = { time: string; available: boolean };

export default function BookClient({
  slug,
  secondaryLanguage,
}: {
  slug: string;
  secondaryLanguage?: string | null;
}) {
  const lang = normalizeSecondaryLanguage(secondaryLanguage);
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [services, setServices] = useState<Service[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<{ confirmed: boolean } | null>(null);

  const [serviceId, setServiceId] = useState<string>();
  const [doctorId, setDoctorId] = useState<string>();
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [notes, setNotes] = useState("");

  const selectedService = services.find((s) => s.id === serviceId);
  const durationMins = selectedService?.durationMins ?? 30;
  const anyDoctorSecondary = translateUi("Any available doctor", lang);
  const notesPlaceholderSecondary = translateUi("Notes for the clinic (optional)", lang);
  const notesPlaceholder = notesPlaceholderSecondary
    ? `Notes for the clinic (optional) / ${notesPlaceholderSecondary}`
    : "Notes for the clinic (optional)";

  useEffect(() => {
    void getBookingServices(slug).then(setServices);
    void getBookingDoctors(slug).then(setDoctors);
  }, [slug]);

  useEffect(() => {
    if (!date) return;
    void getSlotsForDate({ slug, date, durationMins, doctorId }).then(setSlots);
  }, [slug, date, durationMins, doctorId]);

  function handleSubmit() {
    if (!date || !time) return;
    setError("");
    startTransition(async () => {
      try {
        const result = await submitBookingRequest({
          slug,
          serviceId,
          doctorId,
          requestedDate: date,
          requestedTime: time,
          durationMins,
          notes: notes || undefined,
        });
        setSuccess({ confirmed: result.confirmed });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Booking failed");
      }
    });
  }

  if (success) {
    return (
      <div className="py-12 text-center">
        <p className="mb-4 text-4xl">✓</p>
        <h1 className="text-xl font-bold">
          {success.confirmed ? (
            <Bilingual text="Appointment confirmed!" lang={lang} />
          ) : (
            <Bilingual text="Booking request received" lang={lang} />
          )}
        </h1>
        <p className="mt-2 text-muted-foreground">
          {success.confirmed ? (
            `See you on ${date} at ${time}`
          ) : (
            <Bilingual text="We'll confirm by email within 24 hours" lang={lang} />
          )}
        </p>
        <button
          type="button"
          onClick={() => router.push(`/portal/${slug}/appointments`)}
          className="mt-6 rounded-lg bg-blue-600 px-6 py-2 text-white"
        >
          <Bilingual text="View appointments" lang={lang} className="text-xs text-white/70" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PortalDesktopNav slug={slug} />
      <h1 className="text-xl font-bold">
        <Bilingual text="Book an appointment" lang={lang} />
      </h1>

      <div className="flex gap-2 text-xs">
        {[1, 2, 3, 4].map((s) => (
          <span
            key={s}
            className={`rounded-full px-2 py-1 ${step === s ? "bg-blue-600 text-white" : "bg-gray-200"}`}
          >
            <Bilingual text="Step" lang={lang} className="text-[10px]" /> {s}
          </span>
        ))}
      </div>

      {step === 1 && (
        <div className="space-y-3">
          <h2 className="font-semibold">
            <Bilingual text="Select a service" lang={lang} />
          </h2>
          {services.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => {
                setServiceId(s.id);
                setStep(2);
              }}
              className={`w-full rounded-xl border p-4 text-left hover:border-blue-400 ${
                serviceId === s.id ? "border-blue-600 bg-blue-50" : ""
              }`}
            >
              <p className="font-medium">{s.name}</p>
              <p className="text-xs text-muted-foreground">
                {s.durationMins} min · AED {Number(s.sellingPrice).toFixed(2)}
              </p>
            </button>
          ))}
          <button type="button" onClick={() => setStep(2)} className="text-sm text-blue-600">
            <Bilingual text="Skip — general appointment" lang={lang} className="text-xs" /> →
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-3">
          <h2 className="font-semibold">
            <Bilingual text="Select doctor & date" lang={lang} />
          </h2>
          <select
            value={doctorId ?? ""}
            onChange={(e) => setDoctorId(e.target.value || undefined)}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          >
            <option value="">
              Any available doctor
              {anyDoctorSecondary ? ` / ${anyDoctorSecondary}` : ""}
            </option>
            {doctors.map((d) => (
              <option key={d.id} value={d.id}>
                {d.firstName} {d.lastName} ({d.role})
              </option>
            ))}
          </select>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            min={new Date().toISOString().split("T")[0]}
            className="w-full rounded-lg border px-3 py-2 text-sm"
          />
          <button
            type="button"
            disabled={!date}
            onClick={() => setStep(3)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            <Bilingual text="Next" lang={lang} className="text-xs text-white/70" />
          </button>
        </div>
      )}

      {step === 3 && (
        <div className="space-y-3">
          <h2 className="font-semibold">
            <Bilingual text="Select time" lang={lang} />
          </h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((slot) => (
              <button
                key={slot.time}
                type="button"
                disabled={!slot.available}
                onClick={() => {
                  setTime(slot.time);
                  setStep(4);
                }}
                className={`rounded-lg border py-2 text-sm ${
                  slot.available
                    ? "hover:border-blue-500"
                    : "cursor-not-allowed bg-gray-100 text-gray-400"
                } ${time === slot.time ? "border-blue-600 bg-blue-50" : ""}`}
              >
                {slot.time}
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="space-y-3">
          <h2 className="font-semibold">
            <Bilingual text="Confirm booking" lang={lang} />
          </h2>
          <div className="rounded-xl border bg-gray-50 p-4 text-sm space-y-1">
            {selectedService && <p>Service: {selectedService.name}</p>}
            <p>Date: {date}</p>
            <p>Time: {time}</p>
            <p>Duration: {durationMins} minutes</p>
            {selectedService && (
              <p>Est. price: AED {Number(selectedService.sellingPrice).toFixed(2)}</p>
            )}
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={notesPlaceholder}
            className="w-full rounded-lg border px-3 py-2 text-sm"
            rows={3}
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? (
              <Bilingual text="Submitting..." lang={lang} className="text-xs text-white/70" />
            ) : (
              <Bilingual text="Confirm booking" lang={lang} className="text-xs text-white/70" />
            )}
          </button>
        </div>
      )}

      <PortalNav slug={slug} />
    </div>
  );
}
