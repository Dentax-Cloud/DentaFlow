"use client";

import { useState, useTransition } from "react";
import { updatePortalSettings } from "./actions";
import QRCode from "qrcode";
import { useEffect, useRef } from "react";

type Settings = {
  slug: string;
  portalEnabled: boolean;
  bookingEnabled: boolean;
  autoConfirmBooking: boolean;
  bookingLeadHours: number;
  bookingMaxDays: number;
  bookingBufferMins: number;
  portalWelcomeMsg: string | null;
  portalLogoUrl: string | null;
};

export default function PortalSettingsClient({
  settings,
  portalUrl,
}: {
  settings: Settings;
  portalUrl: string;
}) {
  const [form, setForm] = useState(settings);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const qrRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (qrRef.current) {
      void QRCode.toCanvas(qrRef.current, portalUrl, { width: 160, margin: 1 });
    }
  }, [portalUrl]);

  function toggle(key: keyof Settings, value: boolean | number | string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSave() {
    startTransition(async () => {
      await updatePortalSettings({
        portalEnabled: form.portalEnabled,
        bookingEnabled: form.bookingEnabled,
        autoConfirmBooking: form.autoConfirmBooking,
        bookingLeadHours: form.bookingLeadHours,
        bookingMaxDays: form.bookingMaxDays,
        bookingBufferMins: form.bookingBufferMins,
        portalWelcomeMsg: form.portalWelcomeMsg ?? undefined,
        portalLogoUrl: form.portalLogoUrl ?? undefined,
      });
      setMessage("Settings saved");
    });
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Patient Portal</h1>
        <p className="text-sm text-muted-foreground">
          Configure your clinic&apos;s patient portal and online booking
        </p>
      </div>

      <div className="rounded-xl border bg-white p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Enable patient portal</p>
            <p className="text-xs text-muted-foreground">Patients can sign in at your portal URL</p>
          </div>
          <input
            type="checkbox"
            checked={form.portalEnabled}
            onChange={(e) => toggle("portalEnabled", e.target.checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Online booking</p>
            <p className="text-xs text-muted-foreground">Let patients request appointments online</p>
          </div>
          <input
            type="checkbox"
            checked={form.bookingEnabled}
            onChange={(e) => toggle("bookingEnabled", e.target.checked)}
          />
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium">Auto-confirm bookings</p>
            <p className="text-xs text-muted-foreground">Skip reception approval queue</p>
          </div>
          <input
            type="checkbox"
            checked={form.autoConfirmBooking}
            onChange={(e) => toggle("autoConfirmBooking", e.target.checked)}
          />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-medium">Lead time (hours)</label>
            <input
              type="number"
              value={form.bookingLeadHours}
              onChange={(e) => toggle("bookingLeadHours", Number(e.target.value))}
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Max days ahead</label>
            <input
              type="number"
              value={form.bookingMaxDays}
              onChange={(e) => toggle("bookingMaxDays", Number(e.target.value))}
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
            />
          </div>
          <div>
            <label className="text-xs font-medium">Buffer (mins)</label>
            <input
              type="number"
              value={form.bookingBufferMins}
              onChange={(e) => toggle("bookingBufferMins", Number(e.target.value))}
              className="mt-1 w-full rounded border px-2 py-1 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-medium">Welcome message</label>
          <textarea
            value={form.portalWelcomeMsg ?? ""}
            onChange={(e) => toggle("portalWelcomeMsg", e.target.value)}
            className="mt-1 w-full rounded border px-3 py-2 text-sm"
            rows={2}
          />
        </div>
      </div>

      <div className="rounded-xl border bg-white p-5">
        <p className="text-sm font-medium">Portal URL</p>
        <code className="mt-1 block rounded bg-gray-100 px-2 py-1 text-sm">{portalUrl}</code>
        <canvas ref={qrRef} className="mt-4" />
        <p className="mt-2 text-xs text-muted-foreground">Patients can scan this QR code to open the portal</p>
      </div>

      {message && <p className="text-sm text-green-600">{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="rounded-lg bg-blue-600 px-6 py-2 text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending ? "Saving..." : "Save settings"}
      </button>
    </div>
  );
}
