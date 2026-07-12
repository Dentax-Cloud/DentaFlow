"use server";

import { db } from "@/lib/db";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { sendMail } from "@/lib/mail";
import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { clinicLocalToUtc, resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";

export async function getBookingRequests() {
  const ctx = await requireRouteAccess("appointments", "read");

  return db.bookingRequest.findMany({
    where: { tenantId: ctx.tenant.id, status: "PENDING" },
    include: {
      patient: {
        select: { firstName: true, lastName: true, patientId: true, email: true },
      },
      portalAccount: { select: { email: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function confirmBookingRequest(bookingId: string) {
  const ctx = await requireRouteAccess("appointments", "write");

  const booking = await db.bookingRequest.findFirst({
    where: { id: bookingId, tenantId: ctx.tenant.id, status: "PENDING" },
    include: {
      patient: { select: { firstName: true, lastName: true, email: true } },
      portalAccount: { select: { email: true } },
    },
  });

  if (!booking) throw new Error("Booking not found");

  const clinicTz = resolveClinicTimezone(ctx.tenant.timezone);
  const startTime = clinicLocalToUtc(
    booking.requestedDate,
    booking.requestedTime,
    clinicTz,
  );
  const endTime = new Date(startTime.getTime() + booking.durationMins * 60 * 1000);

  const { createAppointmentWithSlotLock } =
    await import("@/lib/appointments/create-with-slot-lock");

  const appointmentId = randomUUID();
  const locked = await createAppointmentWithSlotLock({
    id: appointmentId,
    tenantId: ctx.tenant.id,
    patientId: booking.patientId,
    doctorId: booking.doctorId,
    startTime,
    endTime,
    title: "Online booking",
    status: "CONFIRMED",
    notes: booking.notes,
    type: "ONLINE_BOOKING",
    bookedVia: "PORTAL",
  });

  if (!locked.success) {
    throw new Error(locked.error);
  }

  await db.bookingRequest.update({
    where: { id: booking.id },
    data: {
      status: "CONFIRMED",
      appointmentId,
      confirmedAt: new Date(),
    },
  });

  const email = booking.portalAccount.email ?? booking.patient.email;
  if (email) {
    await sendMail({
      to: email,
      subject: `Appointment confirmed — ${ctx.tenant.name}`,
      text: `Dear ${booking.patient.firstName},

Your appointment has been confirmed.

Date: ${booking.requestedDate}
Time: ${booking.requestedTime}

${ctx.tenant.name}`,
    }).catch(() => null);
  }

  revalidatePath("/appointments/booking-requests");
  return { success: true };
}

export async function rejectBookingRequest(bookingId: string, reason?: string) {
  const ctx = await requireRouteAccess("appointments", "write");

  const booking = await db.bookingRequest.findFirst({
    where: { id: bookingId, tenantId: ctx.tenant.id, status: "PENDING" },
    include: {
      patient: { select: { firstName: true, email: true } },
      portalAccount: { select: { email: true } },
    },
  });

  if (!booking) throw new Error("Booking not found");

  await db.bookingRequest.update({
    where: { id: booking.id },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectedReason: reason ?? null,
    },
  });

  const email = booking.portalAccount.email ?? booking.patient.email;
  if (email) {
    await sendMail({
      to: email,
      subject: `Appointment request update — ${ctx.tenant.name}`,
      text: `Dear ${booking.patient.firstName},

Unfortunately we could not confirm your requested appointment.

${reason ? `Reason: ${reason}` : "Please contact the clinic to reschedule."}

${ctx.tenant.name}`,
    }).catch(() => null);
  }

  revalidatePath("/appointments/booking-requests");
  return { success: true };
}
