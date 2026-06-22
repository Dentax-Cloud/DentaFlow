import type { Prisma } from "@prisma/client";
import type { PatientDetailProfile } from "./PatientDetailClient";

export type PatientWith360 = Prisma.PatientGetPayload<{
  include: {
    appointments: true;
    treatmentPlans: true;
    invoices: true;
    clinicalNotes: true;
    attachments: true;
    teeth: { include: { conditions: true } };
    recalls: true;
  };
}>;

function formatMedicalHistory(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value.trim() || undefined;
  try {
    const text = JSON.stringify(value, null, 2);
    return text === "{}" || text === "[]" ? undefined : text;
  } catch {
    return String(value);
  }
}

export function mapPatientTo360Profile(p: PatientWith360): PatientDetailProfile {
  const findings = p.teeth.reduce((sum, t) => sum + t.conditions.length, 0);

  return {
    id: p.id,
    patientId: p.patientNumber,
    firstName: p.firstName,
    lastName: p.lastName,
    dateOfBirth: p.dateOfBirth?.toISOString(),
    gender: p.gender ?? undefined,
    phone: p.phone ?? "",
    email: p.email ?? undefined,
    address: [p.address, p.city].filter(Boolean).join(", ") || undefined,
    medicalHistory: formatMedicalHistory(p.medicalHistory),
    allergies: p.allergies ?? [],
    createdAt: p.createdAt.toISOString(),
    portalUserId: p.portalUserId,
    medications: p.medications ?? [],
    notes: p.notes ?? undefined,
    emergencyContact: p.emergencyContact ?? undefined,
    emergencyPhone: p.emergencyPhone ?? undefined,
    noShowRisk: p.noShowRisk ?? undefined,
    churnRisk: p.churnRisk ?? undefined,
    lastVisitAt: p.lastVisitAt?.toISOString(),
    nextRecallDue: p.recalls
      .filter((r) => r.status === "PENDING" && !r.completedAt)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())[0]
      ?.dueDate.toISOString(),
    teethFindings: findings,
    appointments: p.appointments.map((a) => ({
      id: a.id,
      title: a.title,
      status: a.status,
      startTime: a.startTime.toISOString(),
      endTime: a.endTime.toISOString(),
    })),
    treatmentPlans: p.treatmentPlans.map((tp) => ({
      id: tp.id,
      title: tp.title,
      status: tp.status,
      totalCost: Number(tp.totalCost),
      createdAt: tp.createdAt.toISOString(),
    })),
    invoices: p.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      total: Number(inv.total),
      createdAt: inv.createdAt.toISOString(),
    })),
    clinicalNotes: p.clinicalNotes.map((n) => ({
      id: n.id,
      visitDate: n.visitDate.toISOString(),
      assessment: n.assessment,
      aiGenerated: n.aiGenerated,
    })),
    attachments: p.attachments.map((f) => ({
      id: f.id,
      name: f.name,
      type: f.type,
      url: f.url,
      createdAt: f.createdAt.toISOString(),
    })),
  };
}
