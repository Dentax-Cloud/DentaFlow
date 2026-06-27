import type { Prisma } from "@prisma/client";
import { serializeDecimal } from "@/lib/utils/serialize";
import type { PatientDetailProfile } from "./PatientDetailClient";

export type PatientWith360 = Prisma.PatientGetPayload<{
  include: {
    customFieldValues: { include: { field: true } };
    appointments: true;
    treatmentPlans: {
      include: { items: { select: { id: true, status: true, totalCost: true } } };
    };
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
    patientId: p.patientId ?? p.patientNumber,
    structuredPatientId: p.patientId ?? undefined,
    patientNumber: p.patientNumber,
    branchCode: p.branchCode ?? undefined,
    bloodGroup: p.bloodGroup ?? undefined,
    photoUrl: p.photoUrl ?? undefined,
    emergencyContactName: p.emergencyContactName ?? p.emergencyContact ?? undefined,
    emergencyContactPhone: p.emergencyContactPhone ?? p.emergencyPhone ?? undefined,
    nationality: p.nationality ?? undefined,
    fatherName: p.fatherName ?? undefined,
    grandfatherName: p.grandfatherName ?? undefined,
    idDocumentType: p.idDocumentType ?? undefined,
    idDocumentNumber: p.idDocumentNumber ?? undefined,
    idDocumentExpiry: p.idDocumentExpiry?.toISOString(),
    insuranceProvider: p.insuranceProvider ?? undefined,
    insuranceNetwork: p.insuranceNetwork ?? undefined,
    insuranceMemberId: p.insuranceMemberId ?? undefined,
    insurancePolicyNo: p.insurancePolicyNo ?? undefined,
    insuranceExpiry: p.insuranceExpiry?.toISOString(),
    occupation: p.occupation ?? undefined,
    employer: p.employer ?? undefined,
    maritalStatus: p.maritalStatus ?? undefined,
    customFieldValues:
      "customFieldValues" in p && Array.isArray(p.customFieldValues)
        ? p.customFieldValues.map((cv) => ({
            label: cv.field.fieldLabel,
            value: cv.value ?? "",
            section: cv.field.section,
          }))
        : [],
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
    treatmentPlans: p.treatmentPlans.map((tp) => {
      const items = "items" in tp && Array.isArray(tp.items) ? tp.items : [];
      const completed = items.filter(
        (i: { status: string }) => i.status.toLowerCase() === "completed",
      ).length;
      return {
        id: tp.id,
        title: tp.title,
        status: tp.status,
        totalCost: Number(serializeDecimal(tp).totalCost ?? 0),
        createdAt: tp.createdAt.toISOString(),
        itemCount: items.length,
        completedCount: completed,
      };
    }),
    invoices: p.invoices.map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      status: inv.status,
      total: Number(serializeDecimal(inv).total ?? 0),
      createdAt: inv.createdAt.toISOString(),
    })),
    clinicalNotes: p.clinicalNotes.map((n) => ({
      id: n.id,
      visitDate: n.visitDate.toISOString(),
      title: n.title,
      assessment: n.assessment,
      subjective: n.subjective,
      aiGenerated: n.aiGenerated,
      signedByName: n.signedByName,
      signedAt: n.signedAt?.toISOString() ?? null,
      toothNumbers: n.toothNumbers ?? [],
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
