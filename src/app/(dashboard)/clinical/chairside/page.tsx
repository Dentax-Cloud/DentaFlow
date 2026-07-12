export const runtime = "nodejs";



import { redirect } from "next/navigation";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";

import { db } from "@/lib/db";

import { serializeDecimal } from "@/lib/utils/serialize";

import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";

import { checkConsentForVisit } from "@/lib/clinical/consent-gate";

import {

  findActiveChairsideSession,

  findActiveChairsideSessionForPatient,

  getOrCreateActiveChairsideSession,

} from "@/lib/clinical/start-chairside-session";

import { encounterWorkspacePath } from "@/lib/clinical/encounter-url";

import { ChairsidePermissionDenied } from "@/components/clinical/chairside-permission-denied";

import { ChairsideSessionBlocked } from "@/components/clinical/chairside-session-blocked";

import { getAppointmentProcedureLines } from "@/app/(dashboard)/features/procedure-lines/actions";
import {
  buildOutstandingPlanItems,
  loadPatientTreatmentPlansForChart,
} from "@/lib/clinical/load-patient-treatment-plans";
import type { ChairsideTreatmentPlan } from "@/components/clinical/treatment-plan-inline-panel";
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

  const ctx = await requireRouteAccess("clinical_chart", "read");

  if (appointmentId) {
    redirect(
      encounterWorkspacePath(appointmentId, "chart", {
        sessionId: sessionId ?? undefined,
      }),
    );
  }

  if (!patientId) redirect("/clinical");



  const role = ctx.staffMember?.role;

  const canRead = Boolean(role && hasPermission(role, PERMISSIONS.clinical_chart.read));

  const canWrite = Boolean(role && hasPermission(role, PERMISSIONS.clinical_chart.write));



  if (!canRead) {

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



  if (canWrite) {

    const consent = await checkConsentForVisit(ctx.tenant.id, patientId);

    if (!consent.ok) {

      return (

        <ChairsideSessionBlocked

          title="Patient consent required"

          message={consent.message}

          missingPlans={consent.missingPlans}

        />

      );

    }

  }



  const medicalHistoryText =

    patient.medicalHistory && typeof patient.medicalHistory === "object"

      ? JSON.stringify(patient.medicalHistory)

      : typeof patient.medicalHistory === "string"

        ? patient.medicalHistory

        : null;



  let chairsideSession = null;



  if (sessionId) {

    const existing = await findActiveChairsideSession({

      tenantId: ctx.tenant.id,

      sessionId,

      patientId,

    });

    if (existing) {

      chairsideSession = existing;

    }

  }



  if (!chairsideSession) {

    chairsideSession = await findActiveChairsideSessionForPatient({

      tenantId: ctx.tenant.id,

      patientId,

      appointmentId,

    });

  }



  if (!chairsideSession && canWrite) {

    try {

      chairsideSession = await getOrCreateActiveChairsideSession({

        tenantId: ctx.tenant.id,

        staffMemberId: ctx.staffMember?.id ?? null,

        patientId,

        appointmentId,

        skipConsentCheck: true,

      });

    } catch (error) {

      const message =

        error instanceof Error ? error.message : "Unable to start chairside session.";

      return <ChairsideSessionBlocked title="Cannot open chairside" message={message} />;

    }

  }



  if (!chairsideSession) {

    return (

      <ChairsideSessionBlocked

        title="No active chairside session"

        message="There is no active chairside session for this patient. A clinician must start treatment before you can view live chart entries."

      />

    );

  }



  const procedures = await db.procedureCatalog.findMany({

    where: { tenantId: ctx.tenant.id, isActive: true },

    orderBy: { name: "asc" },

  });

  const resolvedAppointmentId = appointmentId ?? chairsideSession.appointmentId ?? null;

  const procedureLines =
    resolvedAppointmentId
      ? await getAppointmentProcedureLines(resolvedAppointmentId).catch(() => [])
      : [];

  const rawTreatmentPlans = await loadPatientTreatmentPlansForChart(patient.id).catch(() => []);
  const treatmentPlans: ChairsideTreatmentPlan[] = rawTreatmentPlans;

  const outstandingPlanItems = buildOutstandingPlanItems(
    treatmentPlans,
    resolvedAppointmentId,
  );



  return (

    <div className="h-[calc(100vh-64px)] overflow-auto p-4">

      <ChairsidePageClient

        canWrite={canWrite}

        countryCode={ctx.tenant.countryCode}

        currentStaffMemberId={ctx.staffMember?.id ?? null}

        procedureLines={procedureLines}

        treatmentPlans={treatmentPlans}

        outstandingPlanItems={outstandingPlanItems}

        session={{

          id: chairsideSession.id,

          patientId: patient.id,

          appointmentId: resolvedAppointmentId,

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

          notes: chairsideSession.notes,

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


