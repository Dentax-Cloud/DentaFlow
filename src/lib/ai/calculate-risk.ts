import type { RiskLevel } from "@prisma/client";

export type RiskBand = "LOW" | "MEDIUM" | "HIGH";

export function calculateNoShowRisk(patient: {
  appointmentCount: number;
  noShowCount: number;
  lastVisitDate: Date | null;
}): RiskBand {
  if (patient.appointmentCount === 0) return "LOW";
  const noShowRate = patient.noShowCount / patient.appointmentCount;
  if (noShowRate > 0.4) return "HIGH";
  if (noShowRate > 0.2) return "MEDIUM";
  return "LOW";
}

export function calculateChurnRisk(patient: {
  lastVisitDate: Date | null;
  recallDueDate: Date | null;
}): RiskBand {
  if (!patient.lastVisitDate) return "MEDIUM";
  const daysSinceLastVisit =
    (Date.now() - patient.lastVisitDate.getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceLastVisit > 365) return "HIGH";
  if (daysSinceLastVisit > 180) return "MEDIUM";
  if (patient.recallDueDate && patient.recallDueDate.getTime() < Date.now()) {
    return "HIGH";
  }
  return "LOW";
}

export function toRiskLevel(band: RiskBand): RiskLevel {
  return band;
}
