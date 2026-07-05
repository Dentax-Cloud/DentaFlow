"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import {
  calculatePerioStaging,
  comparePerioCharts,
  getPerioRiskLevel,
} from "@/lib/clinical/perio-calc";
import type { PerioMeasurement } from "@/lib/clinical/types";
import { RiskLevel } from "@prisma/client";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";

function mapRiskToPatientField(
  risk: ReturnType<typeof getPerioRiskLevel>,
): RiskLevel {
  switch (risk) {
    case "LOW":
      return RiskLevel.LOW;
    case "MODERATE":
      return RiskLevel.MEDIUM;
    case "HIGH":
    case "VERY_HIGH":
      return RiskLevel.HIGH;
  }
}

export async function createPerioChart(input: {
  patientId: string;
  measurements: PerioMeasurement[];
  notes?: string;
  examinerId?: string;
}) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const patient = await db.patient.findFirst({
    where: { id: input.patientId, tenantId: ctx.tenantId, deletedAt: null },
  });
  if (!patient) throw new Error("Patient not found");

  const staging = calculatePerioStaging(input.measurements);
  const risk = getPerioRiskLevel(staging);

  const chart = await db.perioChart.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      examinerId: input.examinerId ?? ctx.staffMember?.id ?? null,
      measurements: input.measurements,
      perioStage: staging.stage,
      perioGrade: staging.grade,
      bopPercent: staging.bopPercent,
      notes: input.notes ?? null,
    },
  });

  await db.patient
    .update({
      where: { id: input.patientId, tenantId: ctx.tenantId },
      data: { churnRisk: mapRiskToPatientField(risk) },
    })
    .catch(() => null);

  await db.auditLog
    .create({
      data: {
        tenantId: ctx.tenantId,
        userId: ctx.staffMember?.id,
        performedById: ctx.staffMember?.id,
        action: "CREATE",
        entity: "PerioChart",
        entityId: chart.id,
        metadata: {
          patientId: input.patientId,
          stage: staging.stage,
          grade: staging.grade,
          bopPercent: staging.bopPercent,
        },
      },
    })
    .catch(() => null);

  revalidatePath("/clinical/perio");
  revalidatePath(`/patients/${input.patientId}`);
  return { chart, staging };
}

export async function getPerioHistory(patientId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);

  return db.perioChart.findMany({
    where: { tenantId: ctx.tenantId, patientId },
    orderBy: { chartDate: "desc" },
  });
}

export async function getLatestPerioChart(patientId: string) {
  const ctx = await requireTenantContext();

  return db.perioChart.findFirst({
    where: { tenantId: ctx.tenantId, patientId },
    orderBy: { chartDate: "desc" },
  });
}

export async function comparePerioChartRecords(chartId1: string, chartId2: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);

  const [chart1, chart2] = await Promise.all([
    db.perioChart.findFirst({
      where: { id: chartId1, tenantId: ctx.tenantId },
    }),
    db.perioChart.findFirst({
      where: { id: chartId2, tenantId: ctx.tenantId },
    }),
  ]);

  if (!chart1 || !chart2) throw new Error("Chart not found");

  const baseline = chart1.measurements as PerioMeasurement[];
  const current = chart2.measurements as PerioMeasurement[];

  return {
    chart1,
    chart2,
    comparison: comparePerioCharts(baseline, current),
    staging1: calculatePerioStaging(baseline),
    staging2: calculatePerioStaging(current),
  };
}

export async function deletePerioChart(chartId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.write);

  const chart = await db.perioChart.findFirst({
    where: { id: chartId, tenantId: ctx.tenantId },
  });
  if (!chart) throw new Error("Chart not found");

  await db.perioChart.delete({
    where: { id: chartId, tenantId: ctx.tenantId },
  });

  revalidatePath("/clinical/perio");
  revalidatePath(`/patients/${chart.patientId}`);
}

export async function calculatePerioRisk(patientId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical_chart.read);

  const latest = await getLatestPerioChart(patientId);
  if (!latest) return { risk: "LOW" as const, staging: null };

  const measurements = latest.measurements as PerioMeasurement[];
  const staging = calculatePerioStaging(measurements);
  return { risk: getPerioRiskLevel(staging), staging };
}
