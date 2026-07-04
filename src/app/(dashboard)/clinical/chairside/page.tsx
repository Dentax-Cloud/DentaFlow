export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import {
  getChairsideSession,
  startChairsideSession,
} from "@/app/(dashboard)/features/clinical/chairside-actions";
import { ChairsidePermissionDenied } from "@/components/clinical/chairside-permission-denied";
import ChairsidePageClient from "./chairside-client";

export default async function ChairsidePage({
  searchParams,
}: {
  searchParams: Promise<{
    patientId?: string;
    appointmentId?: string;
    sessionId?: string;
  }>;
}) {
  const { patientId, appointmentId, sessionId } = await searchParams;
  const ctx = await requireRouteAccess("clinical", "read");

  if (!patientId) redirect("/clinical");

  const role = ctx.staffMember?.role;
  if (!role || !hasPermission(role, PERMISSIONS.clinical.write)) {
    return <ChairsidePermissionDenied />;
  }

  const patient = await db.patient.findFirst({
    where: { id: patientId, tenantId: ctx.tenant.id, deletedAt: null },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      allergies: true,
      bloodGroup: true,
      medicalHistory: true,
    },
  });
  if (!patient) redirect("/clinical");

  const medicalHistoryText =
    patient.medicalHistory && typeof patient.medicalHistory === "object"
      ? JSON.stringify(patient.medicalHistory)
      : typeof patient.medicalHistory === "string"
        ? patient.medicalHistory
        : null;

  let chairsideSession = null;

  if (sessionId) {
    const existing = await getChairsideSession(sessionId);
    if (
      existing &&
      existing.status === "ACTIVE" &&
      existing.patientId === patientId
    ) {
      chairsideSession = existing;
    }
  }

  if (!chairsideSession) {
    chairsideSession = await startChairsideSession({
      patientId,
      appointmentId,
    });
  }

  const procedures = await db.procedureCatalog.findMany({
    where: { tenantId: ctx.tenant.id, isActive: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="h-[calc(100vh-64px)] overflow-auto p-4">
      <ChairsidePageClient
        session={{
          id: chairsideSession.id,
          patientId: patient.id,
          appointmentId: appointmentId ?? chairsideSession.appointmentId ?? null,
          entries: chairsideSession.entries.map((e) => {
            const serialized = serializeDecimal(e);
            return {
              id: e.id,
              toothNumber: e.toothNumber,
              surface: e.surface,
              procedureCode: e.procedureCode,
              procedureName: e.procedureName,
              conditionType: e.conditionType,
              notes: e.notes,
              unitPrice: Number(serialized.unitPrice ?? 0),
              quantity: e.quantity,
              includeInInvoice: e.includeInInvoice,
            };
          }),
        }}
        patient={{
          ...patient,
          medicalHistory: medicalHistoryText,
        }}
        procedures={procedures.map((p) => {
          const serialized = serializeDecimal(p);
          return {
            id: p.id,
            code: p.code,
            name: p.name,
            category: p.category ?? "",
            durationMins: p.duration ?? 30,
            sellingPrice: Number(serialized.price ?? 0),
          };
        })}
      />
    </div>
  );
}
