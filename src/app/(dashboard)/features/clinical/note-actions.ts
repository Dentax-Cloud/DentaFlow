"use server";

import { revalidatePath } from "next/cache";
import { AppointmentStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { requireFeature } from "@/lib/features/gate";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { enhanceClinicalText } from "@/lib/ai/enhance-clinical-text";
import { chartToSummary } from "@/lib/clinical/chart-types";
import type { ToothChartData } from "@/lib/clinical/chart-types";
import {
  saveClinicalNoteSchema,
  updateClinicalNoteSchema,
  noteIdSchema,
  noteAutoFillSchema,
  enhanceNoteTextSchema,
} from "./note-schemas";

async function requireStaffId(ctx: Awaited<ReturnType<typeof import("@/lib/tenant/context").requireTenantContext>>) {
  const staffId = ctx.staffMember?.id;
  if (!staffId) throw new Error("Staff profile required");
  return staffId;
}

function providerNameFromCtx(
  ctx: Awaited<ReturnType<typeof import("@/lib/tenant/context").requireTenantContext>>,
) {
  return ctx.staffMember
    ? `${ctx.staffMember.firstName} ${ctx.staffMember.lastName}`.trim()
    : "Provider";
}

async function buildAutoFillVariables(
  tenantId: string,
  patientId: string,
  appointmentId: string | undefined,
  ctx: Awaited<ReturnType<typeof import("@/lib/tenant/context").requireTenantContext>>,
) {
  const patient = await db.patient.findFirst({
    where: tenantWhere(tenantId, { id: patientId, deletedAt: null }),
    include: {
      teeth: { include: { conditions: { orderBy: { recordedAt: "desc" } } } },
      appointments: appointmentId
        ? { where: { id: appointmentId } }
        : {
            where: {
              startTime: {
                gte: new Date(new Date().setHours(0, 0, 0, 0)),
                lt: new Date(new Date().setHours(23, 59, 59, 999)),
              },
            },
            take: 1,
          },
    },
  });
  if (!patient) throw new Error("Patient not found");

  const chartData: ToothChartData = {};
  const toothNumbers: string[] = [];
  for (const tooth of patient.teeth) {
    if (tooth.conditions.length === 0) continue;
    toothNumbers.push(tooth.number);
    chartData[tooth.number] = {
      conditions: tooth.conditions.map((c) => ({
        id: c.id,
        type: c.type,
        surfaces: c.surfaces,
        severity: c.severity,
        notes: c.notes,
        recordedAt: c.recordedAt.toISOString(),
      })),
    };
  }

  const findings = chartToSummary(chartData);
  const conditions = toothNumbers.length
    ? toothNumbers
        .map((t) => {
          const entry = chartData[t];
          if (!entry) return "";
          return entry.conditions
            .map((c) => `${c.type.replace(/_/g, " ").toLowerCase()}`)
            .join(", ");
        })
        .filter(Boolean)
        .join("; ")
    : "none charted";

  let procedures = "none scheduled";
  const apt = patient.appointments[0];
  if (apt?.title) {
    procedures = apt.title;
  }

  const nextApt = await db.appointment.findFirst({
    where: {
      tenantId,
      patientId,
      startTime: { gt: new Date() },
      status: { notIn: [AppointmentStatus.CANCELED, AppointmentStatus.NO_SHOW] },
    },
    orderBy: { startTime: "asc" },
  });

  return {
    patient_name: `${patient.firstName} ${patient.lastName}`.trim(),
    doctor_name: providerNameFromCtx(ctx),
    clinic_name: ctx.tenant.name,
    date: new Date().toLocaleDateString(),
    chief_complaint: apt?.notes ?? "",
    pain_score: "0",
    findings: findings === "No charted findings." ? "within normal limits" : findings,
    tooth_numbers: toothNumbers.join(", ") || "N/A",
    conditions,
    diagnosis: "",
    procedures,
    procedure_name: apt?.title ?? "",
    followup_weeks: "2",
    next_appointment: nextApt
      ? nextApt.startTime.toLocaleString()
      : "to be scheduled",
    avoid_days: "3",
    perio_summary: "No periodontal chart on file",
  };
}

export const getNoteAutoFillContext = createAction({
  schema: noteAutoFillSchema,
  permission: () => requirePermission(PERMISSIONS.clinical.read),
  handler: async (input, ctx) => {
    const variables = await buildAutoFillVariables(
      ctx.tenant.id,
      input.patientId,
      input.appointmentId,
      ctx,
    );

    const teeth = await db.tooth.findMany({
      where: { tenantId: ctx.tenant.id, patientId: input.patientId },
      include: { conditions: true },
    });
    const toothNumbers = teeth
      .filter((t) => t.conditions.length > 0)
      .map((t) => t.number);

    return { variables, toothNumbers };
  },
});

export const enhanceNoteText = createAction({
  schema: enhanceNoteTextSchema,
  permission: async () => {
    await requireFeature("aiEnabled");
    return requirePermission(PERMISSIONS.ai.use);
  },
  handler: async (input) => enhanceClinicalText(input.text),
});

export const saveClinicalNote = createAction({
  schema: saveClinicalNoteSchema,
  permission: () => requirePermission(PERMISSIONS.clinical.write),
  handler: async (input, ctx) => {
    const providerId = await requireStaffId(ctx);
    const providerName = providerNameFromCtx(ctx);

    const patient = await db.patient.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.patientId, deletedAt: null }),
    });
    if (!patient) throw new Error("Patient not found");

    const note = await db.clinicalNote.create({
      data: {
        tenantId: ctx.tenant.id,
        patientId: input.patientId,
        providerId,
        appointmentId: input.appointmentId,
        templateId: input.templateId,
        noteType: input.noteType ?? "SOAP",
        title: input.title,
        rawNotes: input.rawNotes,
        subjective: input.subjective,
        objective: input.objective,
        assessment: input.assessment,
        plan: input.plan,
        bodyHtml: input.bodyHtml,
        toothNumbers: input.toothNumbers ?? [],
        aiGenerated: input.aiGenerated ?? false,
        aiEnhanced: input.aiEnhanced ?? false,
        signedAt: new Date(),
        signedByName: providerName,
        versions: {
          create: {
            tenantId: ctx.tenant.id,
            version: 1,
            subjective: input.subjective,
            objective: input.objective,
            assessment: input.assessment,
            plan: input.plan,
            bodyHtml: input.bodyHtml,
            rawNotes: input.rawNotes,
            editedById: ctx.user?.id,
            editedByName: providerName,
          },
        },
      },
      include: { versions: true },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user?.id,
      action: "CREATE",
      entity: "ClinicalNote",
      entityId: note.id,
    });

    revalidatePath("/clinical");
    revalidatePath(`/patients/${input.patientId}`);
    return note;
  },
});

export const updateClinicalNote = createAction({
  schema: updateClinicalNoteSchema,
  permission: () => requirePermission(PERMISSIONS.clinical.write),
  handler: async (input, ctx) => {
    const providerName = providerNameFromCtx(ctx);

    const existing = await db.clinicalNote.findFirst({
      where: tenantWhere(ctx.tenant.id, {
        id: input.noteId,
        patientId: input.patientId,
      }),
    });
    if (!existing) throw new Error("Note not found");

    const nextVersion = existing.currentVersion + 1;

    const note = await db.clinicalNote.update({
      where: { id: existing.id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.rawNotes !== undefined ? { rawNotes: input.rawNotes } : {}),
        ...(input.subjective !== undefined ? { subjective: input.subjective } : {}),
        ...(input.objective !== undefined ? { objective: input.objective } : {}),
        ...(input.assessment !== undefined ? { assessment: input.assessment } : {}),
        ...(input.plan !== undefined ? { plan: input.plan } : {}),
        ...(input.bodyHtml !== undefined ? { bodyHtml: input.bodyHtml } : {}),
        ...(input.toothNumbers !== undefined ? { toothNumbers: input.toothNumbers } : {}),
        ...(input.aiEnhanced !== undefined ? { aiEnhanced: input.aiEnhanced } : {}),
        currentVersion: nextVersion,
        signedAt: new Date(),
        signedByName: providerName,
        versions: {
          create: {
            tenantId: ctx.tenant.id,
            version: nextVersion,
            subjective: input.subjective ?? existing.subjective,
            objective: input.objective ?? existing.objective,
            assessment: input.assessment ?? existing.assessment,
            plan: input.plan ?? existing.plan,
            bodyHtml: input.bodyHtml ?? existing.bodyHtml,
            rawNotes: input.rawNotes ?? existing.rawNotes,
            editedById: ctx.user?.id,
            editedByName: providerName,
          },
        },
      },
    });

    revalidatePath("/clinical");
    revalidatePath(`/patients/${input.patientId}`);
    return note;
  },
});

export const getNoteVersions = createAction({
  schema: noteIdSchema,
  permission: () => requirePermission(PERMISSIONS.clinical.read),
  handler: async (input, ctx) => {
    const note = await db.clinicalNote.findFirst({
      where: tenantWhere(ctx.tenant.id, {
        id: input.noteId,
        patientId: input.patientId,
      }),
      include: {
        versions: { orderBy: { version: "desc" } },
      },
    });
    if (!note) throw new Error("Note not found");

    return {
      noteId: note.id,
      currentVersion: note.currentVersion,
      signedByName: note.signedByName,
      signedAt: note.signedAt?.toISOString(),
      versions: note.versions.map((v) => ({
        version: v.version,
        subjective: v.subjective,
        objective: v.objective,
        assessment: v.assessment,
        plan: v.plan,
        bodyHtml: v.bodyHtml,
        rawNotes: v.rawNotes,
        editedByName: v.editedByName,
        createdAt: v.createdAt.toISOString(),
      })),
    };
  },
});
