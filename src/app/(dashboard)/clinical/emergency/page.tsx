export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";
import EmergencyPageClient from "./emergency-client";

export default async function EmergencyPage({
  searchParams,
}: {
  searchParams: Promise<{ intakeId?: string; tab?: string; date?: string }>;
}) {
  const { intakeId, tab, date } = await searchParams;
  const ctx = await requireRouteAccess("clinical_chart", "read");

  const patients = await db.patient.findMany({
    where: { tenantId: ctx.tenant.id, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      phone: true,
      dateOfBirth: true,
      allergies: true,
      medications: true,
    },
    orderBy: { lastName: "asc" },
    take: 200,
  });

  const targetDate = date ? new Date(date) : new Date();

  const intakes = await db.emergencyIntake.findMany({
    where: {
      tenantId: ctx.tenant.id,
      createdAt: { gte: startOfDay(targetDate), lte: endOfDay(targetDate) },
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          dateOfBirth: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return (
    <EmergencyPageClient
      patients={patients.map((p) => ({
        ...p,
        dateOfBirth: p.dateOfBirth?.toISOString() ?? null,
      }))}
      intakes={intakes.map((i) => ({
        id: i.id,
        patientId: i.patientId,
        chiefComplaint: i.chiefComplaint,
        painScore: i.painScore,
        triageLevel: i.triageLevel,
        status: i.status,
        clinicalNote: i.clinicalNote,
        createdAt: i.createdAt.toISOString(),
        patient: {
          ...i.patient,
          dateOfBirth: i.patient.dateOfBirth?.toISOString() ?? null,
        },
      }))}
      selectedIntakeId={intakeId ?? null}
      defaultTab={tab ?? "queue"}
      date={date ?? new Date().toISOString().split("T")[0]}
    />
  );
}
