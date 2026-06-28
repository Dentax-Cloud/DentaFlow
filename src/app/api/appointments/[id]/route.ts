export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const ctx = await requireTenantContext();

    const appointment = await db.appointment.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: {
        patient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            patientId: true,
            patientNumber: true,
            phone: true,
            email: true,
            bloodGroup: true,
            allergies: true,
            insuranceProvider: true,
            insuranceNetwork: true,
            insuranceCoPayPercent: true,
          },
        },
        doctor: {
          select: {
            id: true,
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
        },
        provider: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
        chair: { select: { id: true, name: true } },
        branch: { select: { name: true } },
      },
    });

    if (!appointment) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const doctor = appointment.doctor?.user
      ? {
          id: appointment.doctor.user.id,
          firstName: appointment.doctor.user.firstName,
          lastName: appointment.doctor.user.lastName,
          role: appointment.doctor.user.role,
        }
      : appointment.provider
        ? {
            id: appointment.provider.id,
            firstName: appointment.provider.firstName,
            lastName: appointment.provider.lastName,
            role: appointment.provider.role,
          }
        : null;

    return NextResponse.json({
      appointment: {
        id: appointment.id,
        appointmentRef: appointment.appointmentRef,
        status: appointment.status,
        startTime: appointment.startTime.toISOString(),
        endTime: appointment.endTime.toISOString(),
        notes: appointment.notes,
        type: appointment.type,
        patient: {
          ...appointment.patient,
          insuranceCoPayPercent: appointment.patient.insuranceCoPayPercent
            ? Number(appointment.patient.insuranceCoPayPercent)
            : null,
        },
        doctor,
        chair: appointment.chair,
        branch: appointment.branch,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
