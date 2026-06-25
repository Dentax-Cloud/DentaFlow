"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { randomUUID } from "crypto";

export async function lookupByBarcode(scannedCode: string) {
  const ctx = await requireTenantContext();

  const normalized = scannedCode.replace(/-/g, "").toUpperCase().trim();

  let patient = await db.patient.findFirst({
    where: { tenantId: ctx.tenantId, patientId: scannedCode.trim(), deletedAt: null },
    select: {
      id: true,
      patientId: true,
      firstName: true,
      lastName: true,
      phone: true,
      bloodGroup: true,
      allergies: true,
      photoUrl: true,
    },
  });

  if (!patient) {
    const patients = await db.patient.findMany({
      where: { tenantId: ctx.tenantId, patientId: { not: null }, deletedAt: null },
      select: {
        id: true,
        patientId: true,
        firstName: true,
        lastName: true,
        phone: true,
        bloodGroup: true,
        allergies: true,
        photoUrl: true,
      },
    });
    patient =
      patients.find((p) => p.patientId?.replace(/-/g, "").toUpperCase() === normalized) ?? null;
  }

  await db.barcodeScan
    .create({
      data: {
        id: randomUUID(),
        tenantId: ctx.tenantId,
        scannedCode: scannedCode.trim(),
        barcodeType: "PATIENT_ID",
        scannedById: ctx.staffMember?.id ?? null,
        action: "LOOKUP",
        entityType: "Patient",
        entityId: patient?.id ?? null,
        result: patient ? "FOUND" : "NOT_FOUND",
      },
    })
    .catch(() => null);

  if (!patient) return null;

  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);

  const appointment = await db.appointment.findFirst({
    where: {
      tenantId: ctx.tenantId,
      patientId: patient.id,
      startTime: { gte: start, lte: end },
      status: { notIn: ["COMPLETED", "CANCELED", "NO_SHOW"] },
      deletedAt: null,
    },
    include: {
      doctor: { include: { user: { select: { firstName: true, lastName: true } } } },
    },
    orderBy: { startTime: "asc" },
  });

  return {
    ...patient,
    appointment: appointment
      ? {
          id: appointment.id,
          ref: appointment.appointmentRef ?? appointment.id,
          startTime: appointment.startTime.toISOString(),
          status: appointment.status,
          doctorName: appointment.doctor?.user
            ? `Dr. ${appointment.doctor.user.firstName ?? ""} ${appointment.doctor.user.lastName ?? ""}`.trim()
            : "Unassigned",
        }
      : null,
  };
}

export async function checkinByBarcode(patientId: string, appointmentId: string) {
  const ctx = await requireTenantContext();

  await db.appointment.update({
    where: { id: appointmentId, tenantId: ctx.tenantId },
    data: { status: "ARRIVED" },
  });

  await db.barcodeScan
    .create({
      data: {
        id: randomUUID(),
        tenantId: ctx.tenantId,
        scannedCode: patientId,
        barcodeType: "PATIENT_ID",
        scannedById: ctx.staffMember?.id ?? null,
        action: "CHECKIN",
        entityType: "Appointment",
        entityId: appointmentId,
        result: "CHECKED_IN",
      },
    })
    .catch(() => null);
}
