"use client";

import { useTransition } from "react";
import { confirmBookingRequest, rejectBookingRequest } from "./actions";

type Booking = {
  id: string;
  requestedDate: string;
  requestedTime: string;
  durationMins: number;
  notes: string | null;
  patient: {
    firstName: string;
    lastName: string;
    patientId: string | null;
  };
};

export default function BookingRequestsClient({ bookings }: { bookings: Booking[] }) {
  const [isPending, startTransition] = useTransition();

  function handleConfirm(id: string) {
    startTransition(async () => {
      await confirmBookingRequest(id);
      window.location.reload();
    });
  }

  function handleReject(id: string) {
    const reason = prompt("Reason for declining (optional):") ?? undefined;
    startTransition(async () => {
      await rejectBookingRequest(id, reason);
      window.location.reload();
    });
  }

  if (bookings.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <p>No pending booking requests</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {bookings.map((b) => (
        <div key={b.id} className="rounded-xl border bg-white p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">
                {b.patient.firstName} {b.patient.lastName}
              </p>
              <p className="font-mono text-xs text-muted-foreground">{b.patient.patientId}</p>
              <p className="mt-2 text-sm">
                {b.requestedDate} at {b.requestedTime} ({b.durationMins} min)
              </p>
              {b.notes && <p className="mt-1 text-sm italic text-muted-foreground">{b.notes}</p>}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleConfirm(b.id)}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
              >
                Confirm
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={() => handleReject(b.id)}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
