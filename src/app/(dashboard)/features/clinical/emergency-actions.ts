"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS, hasPermission } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import {
  calculateTriageLevel,
  getComplaintLabel,
  type Vitals,
} from "@/lib/clinical/emergency-types";
import { generateText } from "ai";
import { isAIConfigured, resolveOpenAIModel, SYSTEM_SAFETY } from "@/lib/ai/client";

async function requirePatient(tenantId: string, patientId: string) {
  const patient = await db.patient.findFirst({
    where: tenantWhere(tenantId, { id: patientId, deletedAt: null }),
  });
  if (!patient) throw new Error("Patient not found");
  return patient;
}

async function requireEmergencyRead() {
  const ctx = await requireTenantContext();
  const role = ctx.staffMember?.role;
  if (
    !role ||
    (!hasPermission(role, PERMISSIONS.clinical.read) &&
      !hasPermission(role, PERMISSIONS.appointments.read))
  ) {
    throw new Error("FORBIDDEN");
  }
  return ctx;
}

async function requireEmergencyWrite() {
  const ctx = await requireTenantContext();
  const role = ctx.staffMember?.role;
  if (
    !role ||
    (!hasPermission(role, PERMISSIONS.clinical.write) &&
      !hasPermission(role, PERMISSIONS.appointments.write))
  ) {
    throw new Error("FORBIDDEN");
  }
  return ctx;
}

function buildTemplateSoap(intake: {
  chiefComplaint: string;
  painScore: number;
  painLocation: string | null;
  onset: string | null;
  aggravating: string | null;
  relieving: string | null;
  allergies: string | null;
  medications: string | null;
  vitals: unknown;
  triageLevel: string;
  suggestedCodes: unknown;
  patient: { firstName: string; lastName: string; dateOfBirth: Date | null };
}): string {
  const age = intake.patient.dateOfBirth
    ? Math.floor(
        (Date.now() - intake.patient.dateOfBirth.getTime()) / (365.25 * 24 * 60 * 60 * 1000),
      )
    : null;
  const vitals = intake.vitals as Vitals | null;

  return `S: ${intake.patient.firstName} ${intake.patient.lastName}${
    age ? `, ${age} years old` : ""
  }, presents as emergency with chief complaint of ${getComplaintLabel(intake.chiefComplaint).toLowerCase()}. Pain score ${intake.painScore}/10. ${
    intake.onset ? `Onset: ${intake.onset.replace(/_/g, " ").toLowerCase()}.` : ""
  } ${intake.aggravating ? `Aggravated by: ${intake.aggravating}.` : ""} ${
    intake.relieving ? `Relieved by: ${intake.relieving}.` : ""
  } ${intake.allergies ? `Allergies: ${intake.allergies}.` : "NKDA."} ${
    intake.medications ? `Current medications: ${intake.medications}.` : ""
  }

O: ${intake.painLocation ? `Pain located at: ${intake.painLocation}.` : ""} ${
    vitals
      ? `Vitals: BP ${vitals.bp ?? "not recorded"}, Pulse ${vitals.pulse ?? "not recorded"} bpm, SpO2 ${vitals.spo2 ?? "not recorded"}%.`
      : "Vitals not recorded."
  } Clinical examination to be documented.

A: Emergency dental presentation — ${getComplaintLabel(intake.chiefComplaint).toLowerCase()}. Triage level: ${intake.triageLevel}.

P: Emergency treatment as indicated. ${
    Array.isArray(intake.suggestedCodes) && intake.suggestedCodes.length > 0
      ? `Suggested procedures: ${(intake.suggestedCodes as string[]).join(", ")}.`
      : ""
  } Patient to be seen immediately.`;
}

export async function createEmergencyIntake(input: {
  patientId: string;
  chiefComplaint: string;
  painScore: number;
  painLocation?: string;
  onset?: string;
  aggravating?: string[];
  relieving?: string[];
  vitals?: Vitals;
  allergies?: string;
  medications?: string;
}) {
  const ctx = await requireEmergencyWrite();
  await requirePatient(ctx.tenantId, input.patientId);

  const triageLevel = calculateTriageLevel(input.painScore, input.chiefComplaint);
  const complaintLabel = getComplaintLabel(input.chiefComplaint);

  const branch = await db.branch.findFirst({
    where: { tenantId: ctx.tenantId, deletedAt: null },
    orderBy: { isPrimary: "desc" },
  });

  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 60 * 60 * 1000);

  let appointment: { id: string } | null = null;
  try {
    appointment = await db.appointment.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: input.patientId,
        title: `Emergency — ${complaintLabel}`,
        startTime,
        endTime,
        status: "ARRIVED",
        type: "EMERGENCY",
        notes: `Emergency: ${input.chiefComplaint} | Pain: ${input.painScore}/10`,
        providerId: ctx.staffMember?.id ?? null,
        branchId: branch?.id ?? null,
      },
      select: { id: true },
    });
  } catch {
    appointment = null;
  }

  const intake = await db.emergencyIntake.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      appointmentId: appointment?.id ?? null,
      chiefComplaint: input.chiefComplaint,
      painScore: input.painScore,
      painLocation: input.painLocation ?? null,
      onset: input.onset ?? null,
      aggravating: input.aggravating?.join(", ") ?? null,
      relieving: input.relieving?.join(", ") ?? null,
      vitals: input.vitals ?? undefined,
      allergies: input.allergies ?? null,
      medications: input.medications ?? null,
      triageLevel,
      status: "WAITING",
      attendedById: ctx.staffMember?.id ?? null,
    },
  });

  await db.auditLog
    .create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.staffMember?.id,
        performedById: ctx.staffMember?.id,
        action: "CREATE",
        entity: "EmergencyIntake",
        entityId: intake.id,
        metadata: {
          patientId: input.patientId,
          chiefComplaint: input.chiefComplaint,
          painScore: input.painScore,
          triageLevel,
        },
      },
    })
    .catch(() => null);

  revalidatePath("/clinical/emergency");
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  revalidatePath(`/patients/${input.patientId}`);
  return { intake, appointment };
}

export async function updateEmergencyStatus(intakeId: string, status: string) {
  const ctx = await requireEmergencyWrite();

  const existing = await db.emergencyIntake.findFirst({
    where: { id: intakeId, tenantId: ctx.tenantId },
  });
  if (!existing) throw new Error("Intake not found");

  const intake = await db.emergencyIntake.update({
    where: { id: intakeId },
    data: { status },
  });

  if (intake.appointmentId) {
    const apptStatus =
      status === "IN_CHAIR"
        ? "IN_CHAIR"
        : status === "COMPLETED"
          ? "COMPLETED"
          : status === "WAITING" || status === "IN_TRIAGE"
            ? "ARRIVED"
            : undefined;

    if (apptStatus) {
      await db.appointment
        .updateMany({
          where: { id: intake.appointmentId, tenantId: ctx.tenantId },
          data: { status: apptStatus },
        })
        .catch(() => null);
    }
  }

  revalidatePath("/clinical/emergency");
  revalidatePath("/appointments");
  revalidatePath("/dashboard");
  return intake;
}

export async function updateTriageLevel(intakeId: string, triageLevel: string) {
  const ctx = await requireEmergencyWrite();

  await db.emergencyIntake.updateMany({
    where: { id: intakeId, tenantId: ctx.tenantId },
    data: { triageLevel },
  });

  revalidatePath("/clinical/emergency");
}

export async function saveEmergencyNote(
  intakeId: string,
  clinicalNote: string,
  suggestedCodes?: string[],
) {
  const ctx = await requireEmergencyWrite();

  await db.emergencyIntake.updateMany({
    where: { id: intakeId, tenantId: ctx.tenantId },
    data: {
      clinicalNote,
      suggestedCodes: suggestedCodes ?? undefined,
    },
  });

  revalidatePath("/clinical/emergency");
}

export async function getEmergencyQueue(date?: string) {
  const ctx = await requireEmergencyRead();

  const targetDate = date ? new Date(date) : new Date();

  return db.emergencyIntake.findMany({
    where: {
      tenantId: ctx.tenantId,
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
}

export async function getPatientEmergencyHistory(patientId: string) {
  const ctx = await requireEmergencyRead();
  await requirePatient(ctx.tenantId, patientId);

  return db.emergencyIntake.findMany({
    where: { tenantId: ctx.tenantId, patientId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
}

export async function getEmergencyQueueStats() {
  const ctx = await requireEmergencyRead();
  const todayStart = startOfDay(new Date());
  const todayEnd = endOfDay(new Date());

  const intakes = await db.emergencyIntake.findMany({
    where: {
      tenantId: ctx.tenantId,
      createdAt: { gte: todayStart, lte: todayEnd },
      status: { notIn: ["COMPLETED", "REFERRED"] },
    },
    select: { status: true, triageLevel: true },
  });

  return {
    waitingCount: intakes.filter((i) => i.status === "WAITING").length,
    immediateCount: intakes.filter((i) => i.triageLevel === "IMMEDIATE").length,
    activeCount: intakes.length,
  };
}

export async function generateEmergencySOAP(intakeId: string) {
  const ctx = await requireEmergencyWrite();

  const intake = await db.emergencyIntake.findFirst({
    where: { id: intakeId, tenantId: ctx.tenantId },
    include: {
      patient: {
        select: { firstName: true, lastName: true, dateOfBirth: true },
      },
    },
  });
  if (!intake) throw new Error("Intake not found");

  let soap = buildTemplateSoap(intake);

  if (await isAIConfigured()) {
    try {
      const model = await resolveOpenAIModel();
      if (model) {
        const { text } = await generateText({
          model,
          system: SYSTEM_SAFETY,
          prompt: `Refine this emergency dental SOAP note. Keep the same structure (S/O/A/P). Do not add diagnoses.\n\n${soap}`,
        });
        if (text.trim()) soap = text.trim();
      }
    } catch {
      // fall back to template
    }
  }

  await db.emergencyIntake.update({
    where: { id: intakeId },
    data: { clinicalNote: soap },
  });

  revalidatePath("/clinical/emergency");
  return soap;
}

export async function convertToChairside(intakeId: string) {
  const ctx = await requireEmergencyWrite();

  const intake = await db.emergencyIntake.findFirst({
    where: { id: intakeId, tenantId: ctx.tenantId },
  });
  if (!intake) throw new Error("Intake not found");

  if (intake.status !== "IN_CHAIR" && intake.status !== "COMPLETED") {
    await updateEmergencyStatus(intakeId, "IN_CHAIR");
  }

  return {
    patientId: intake.patientId,
    appointmentId: intake.appointmentId,
    redirectUrl: `/clinical/chairside?patientId=${intake.patientId}${
      intake.appointmentId ? `&appointmentId=${intake.appointmentId}` : ""
    }`,
  };
}
