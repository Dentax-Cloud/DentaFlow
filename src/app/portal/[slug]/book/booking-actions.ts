"use server";

import { requirePortalContext } from "@/lib/portal/portal-context";
import { getAvailableSlots } from "@/lib/portal/availability";
import { clinicLocalToUtc, resolveClinicTimezone } from "@/lib/datetime/clinic-timezone";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { randomUUID } from "crypto";

export async function getBookingServices(slug: string) {
  const tenant = await db.tenant.findFirst({
    where: { slug },
    select: { id: true, bookingEnabled: true },
  });
  if (!tenant?.bookingEnabled) return [];

  const procedures = await db.procedureCatalog.findMany({
    where: { tenantId: tenant.id, isActive: true },
    select: {
      id: true,
      name: true,
      code: true,
      duration: true,
      price: true,
      category: true,
    },
    orderBy: { name: "asc" },
  });

  return procedures.map((p) => ({
    ...p,
    durationMins: p.duration ?? 30,
    sellingPrice: p.price,
  }));
}

export async function getBookingDoctors(slug: string) {
  const tenant = await db.tenant.findFirst({
    where: { slug },
    select: { id: true },
  });
  if (!tenant) return [];

  const doctors = await db.doctor.findMany({
    where: { tenantId: tenant.id },
    include: {
      user: {
        select: { id: true, firstName: true, lastName: true, role: true },
      },
    },
  });

  return doctors
    .filter((d) => d.user)
    .map((d) => ({
      id: d.id,
      firstName: d.user.firstName,
      lastName: d.user.lastName,
      role: d.user.role,
    }));
}

export async function getSlotsForDate(input: {
  slug: string;
  date: string;
  durationMins: number;
  doctorId?: string;
}) {
  const tenant = await db.tenant.findFirst({
    where: { slug: input.slug },
    select: { id: true, bookingBufferMins: true },
  });
  if (!tenant) return [];

  return getAvailableSlots({
    tenantId: tenant.id,
    date: input.date,
    durationMins: input.durationMins,
    doctorId: input.doctorId,
    bufferMins: tenant.bookingBufferMins,
  });
}

export async function submitBookingRequest(input: {
  slug: string;
  serviceId?: string;
  doctorId?: string;
  requestedDate: string;
  requestedTime: string;
  durationMins: number;
  notes?: string;
}) {
  const ctx = await requirePortalContext(input.slug);

  if (!ctx.tenant.bookingEnabled) {
    throw new Error("Online booking is not available");
  }

  const slots = await getAvailableSlots({
    tenantId: ctx.tenantId,
    date: input.requestedDate,
    durationMins: input.durationMins,
    doctorId: input.doctorId,
    bufferMins: ctx.tenant.bookingBufferMins,
  });

  const slot = slots.find((s) => s.time === input.requestedTime);
  if (!slot?.available) {
    throw new Error("This time slot is no longer available. Please select another.");
  }

  const booking = await db.bookingRequest.create({
    data: {
      id: randomUUID(),
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
      portalAccountId: ctx.accountId,
      serviceId: input.serviceId ?? null,
      doctorId: input.doctorId ?? null,
      requestedDate: input.requestedDate,
      requestedTime: input.requestedTime,
      durationMins: input.durationMins,
      notes: input.notes ?? null,
      status: ctx.tenant.autoConfirmBooking ? "CONFIRMED" : "PENDING",
    },
  });

  if (ctx.tenant.autoConfirmBooking) {
    const clinicTz = resolveClinicTimezone(ctx.tenant.timezone);
    const startTime = clinicLocalToUtc(
      input.requestedDate,
      input.requestedTime,
      clinicTz,
    );
    const endTime = new Date(startTime.getTime() + input.durationMins * 60 * 1000);

    const { createAppointmentWithSlotLock } =
      await import("@/lib/appointments/create-with-slot-lock");

    const appointmentId = randomUUID();
    const locked = await createAppointmentWithSlotLock({
      id: appointmentId,
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
      doctorId: input.doctorId ?? null,
      startTime,
      endTime,
      title: "Online booking",
      status: "CONFIRMED",
      notes: input.notes ?? null,
      type: "ONLINE_BOOKING",
      bookedVia: "PORTAL",
    });

    if (!locked.success) {
      // Roll back the booking request claim so patient can retry
      await db.bookingRequest.delete({ where: { id: booking.id } }).catch(() => null);
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
  }

  const service = input.serviceId
    ? await db.procedureCatalog.findUnique({
        where: { id: input.serviceId },
        select: { name: true },
      })
    : null;

  await sendMail({
    to: ctx.email,
    subject: `Appointment ${ctx.tenant.autoConfirmBooking ? "confirmed" : "request received"} — ${ctx.tenant.name}`,
    text: `Dear ${ctx.patient.firstName},

Your appointment ${ctx.tenant.autoConfirmBooking ? "has been confirmed" : "request has been received"}.

Date: ${new Date(input.requestedDate).toLocaleDateString("en-AE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
Time: ${input.requestedTime}
${service ? `Service: ${service.name}` : ""}
${input.notes ? `Notes: ${input.notes}` : ""}

${ctx.tenant.autoConfirmBooking
  ? "Your appointment is confirmed. Please arrive 10 minutes early."
  : "The clinic will confirm your appointment shortly. You will receive another email once confirmed."}

${ctx.tenant.name}
${ctx.tenant.phone ?? ""}`,
  }).catch(() => null);

  if (ctx.tenant.email) {
    await sendMail({
      to: ctx.tenant.email,
      subject: `New online booking request — ${ctx.patient.firstName} ${ctx.patient.lastName}`,
      text: `New booking request received.

Patient: ${ctx.patient.firstName} ${ctx.patient.lastName}
Patient ID: ${ctx.patient.patientId ?? ""}
Date: ${input.requestedDate}
Time: ${input.requestedTime}
${service ? `Service: ${service.name}` : ""}
${input.notes ? `Notes: ${input.notes}` : ""}

Review in dashboard: ${process.env.NEXTAUTH_URL ?? ""}/appointments/booking-requests`,
    }).catch(() => null);
  }

  return {
    success: true,
    bookingId: booking.id,
    confirmed: ctx.tenant.autoConfirmBooking,
  };
}
