export const runtime = "nodejs";

import { redirect, notFound } from "next/navigation";
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
import { getAppointmentProcedureLines } from "@/app/(dashboard)/features/procedure-lines/actions";
import {
  buildOutstandingPlanItems,
  loadPatientTreatmentPlansForChart,
} from "@/lib/clinical/load-patient-treatment-plans";
import { parseAnnotations } from "@/lib/clinical/image-types";
import type { PerioMeasurement } from "@/lib/clinical/types";
import { EncounterWorkspaceClient } from "./encounter-workspace-client";
import type { EncounterTab } from "@/lib/clinical/encounter-url";

const VALID_TABS = new Set<EncounterTab>([
  "chart",
  "perio",
  "radiographs",
  "photos",
  "treatment-plan",
  "emergency",
]);

export default async function EncounterWorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ appointmentId: string }>;
  searchParams: Promise<{ tab?: string; sessionId?: string }>;
}) {
  const { appointmentId } = await params;
  const { tab: tabParam, sessionId } = await searchParams;
  const initialTab =
    tabParam && VALID_TABS.has(tabParam as EncounterTab) ? (tabParam as EncounterTab) : "chart";

  const ctx = await requireRouteAccess("clinical_chart", "read");
  const role = ctx.staffMember?.role;
  const canWrite = Boolean(role && hasPermission(role, PERMISSIONS.clinical_chart.write));

  const appointment = await db.appointment.findFirst({
    where: {
      id: appointmentId,
      tenantId: ctx.tenant.id,
      deletedAt: null,
      isBlock: false,
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          allergies: true,
          bloodGroup: true,
          medicalHistory: true,
        },
      },
      chair: { select: { id: true, name: true } },
      doctor: {
        include: {
          user: { select: { firstName: true, lastName: true } },
        },
      },
    },
  });

  if (!appointment?.patient) notFound();

  const patientId = appointment.patient.id;

  if (canWrite) {
    const consent = await checkConsentForVisit(ctx.tenant.id, patientId);
    if (!consent.ok) {
      redirect(`/clinical/chairside?patientId=${patientId}`);
    }
  }

  let chairsideSession = null;
  if (sessionId) {
    chairsideSession = await findActiveChairsideSession({
      tenantId: ctx.tenant.id,
      sessionId,
      patientId,
    });
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
    } catch {
      // read-only users may view workspace without an active session
    }
  }

  const [
    procedures,
    procedureLines,
    treatmentPlans,
    perioHistory,
    radiographImages,
    photos,
    presentations,
    patientEmergencies,
  ] = await Promise.all([
    db.procedureCatalog.findMany({
      where: { tenantId: ctx.tenant.id, isActive: true },
      orderBy: { name: "asc" },
    }),
    getAppointmentProcedureLines(appointmentId).catch(() => []),
    loadPatientTreatmentPlansForChart(patientId).catch(() => []),
    db.perioChart.findMany({
      where: { tenantId: ctx.tenant.id, patientId },
      orderBy: { chartDate: "desc" },
    }),
    db.clinicalImage.findMany({
      where: { tenantId: ctx.tenant.id, patientId, type: { not: "PHOTO" } },
      orderBy: { takenAt: "desc" },
    }),
    db.clinicalImage.findMany({
      where: { tenantId: ctx.tenant.id, patientId, type: "PHOTO" },
      orderBy: { takenAt: "desc" },
    }),
    db.casePresentation.findMany({
      where: { tenantId: ctx.tenant.id, patientId },
      orderBy: { createdAt: "desc" },
    }),
    db.emergencyIntake.findMany({
      where: {
        tenantId: ctx.tenant.id,
        patientId,
        status: { notIn: ["COMPLETED", "REFERRED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const outstandingPlanItems = buildOutstandingPlanItems(treatmentPlans, appointmentId);

  const medicalHistoryText =
    appointment.patient.medicalHistory && typeof appointment.patient.medicalHistory === "object"
      ? JSON.stringify(appointment.patient.medicalHistory)
      : typeof appointment.patient.medicalHistory === "string"
        ? appointment.patient.medicalHistory
        : null;

  const doctorName = appointment.doctor?.user
    ? `Dr. ${appointment.doctor.user.firstName ?? ""} ${appointment.doctor.user.lastName ?? ""}`.trim()
    : null;

  return (
    <EncounterWorkspaceClient
      canWrite={canWrite}
      countryCode={ctx.tenant.countryCode}
      currentStaffMemberId={ctx.staffMember?.id ?? null}
      initialTab={initialTab}
      appointment={{
        id: appointment.id,
        ref: appointment.appointmentRef,
        startTime: appointment.startTime.toISOString(),
        status: appointment.status,
        chairName: appointment.chair?.name ?? null,
        doctorName,
      }}
      patient={{
        id: patientId,
        firstName: appointment.patient.firstName,
        lastName: appointment.patient.lastName,
        allergies: appointment.patient.allergies,
        bloodGroup: appointment.patient.bloodGroup,
        medicalHistory: medicalHistoryText,
      }}
      session={
        chairsideSession
          ? {
              id: chairsideSession.id,
              patientId,
              appointmentId,
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
            }
          : null
      }
      procedureLines={procedureLines}
      treatmentPlans={treatmentPlans}
      outstandingPlanItems={outstandingPlanItems}
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
      perio={{
        chartHistory: perioHistory.map((c) => ({
          id: c.id,
          chartDate: c.chartDate.toISOString(),
          perioStage: c.perioStage,
          perioGrade: c.perioGrade,
          bopPercent: c.bopPercent,
          notes: c.notes,
          measurements: c.measurements as PerioMeasurement[],
        })),
        currentStaffId: ctx.staffMember?.id ?? null,
        currentStaffName: ctx.staffMember
          ? `${ctx.staffMember.firstName} ${ctx.staffMember.lastName}`.trim()
          : "Provider",
      }}
      radiographs={radiographImages.map((img) => ({
        id: img.id,
        url: img.url,
        type: img.type,
        fileName: img.fileName,
        toothNumbers: img.toothNumbers,
        quadrant: img.quadrant,
        notes: img.notes,
        takenAt: img.takenAt?.toISOString() ?? null,
        annotations: parseAnnotations(img.annotations),
      }))}
      photos={{
        items: photos.map((p) => ({
          id: p.id,
          url: p.url,
          type: p.type,
          fileName: p.fileName,
          toothNumbers: p.toothNumbers,
          quadrant: p.quadrant,
          notes: p.notes,
          photoCategory: p.photoCategory,
          isBeforePhoto: p.isBeforePhoto,
          afterImageId: p.afterImageId,
          takenAt: p.takenAt?.toISOString() ?? null,
          annotations: parseAnnotations(p.annotations),
        })),
        presentations: presentations.map((p) => ({
          id: p.id,
          title: p.title,
          description: p.description,
          imageIds: Array.isArray(p.imageIds) ? (p.imageIds as string[]) : [],
          shareToken: p.shareToken,
          viewCount: p.viewCount,
          createdAt: p.createdAt.toISOString(),
        })),
      }}
      emergencies={patientEmergencies.map((e) => ({
        id: e.id,
        chiefComplaint: e.chiefComplaint,
        painScore: e.painScore,
        triageLevel: e.triageLevel,
        status: e.status,
        createdAt: e.createdAt.toISOString(),
      }))}
    />
  );
}
