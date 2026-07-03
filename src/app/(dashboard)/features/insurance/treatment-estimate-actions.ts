"use server";

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PreAuthStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { calculateInsuranceSplit } from "@/lib/billing/insurance-calculator";
import { isPreAuthDefaultRequired } from "@/lib/countries";
import { buildEstimatePdfBytes } from "@/lib/insurance/generate-estimate-pdf";
import type { ProcedureCodeSnapshot } from "@/lib/insurance/estimate-types";
import {
  serializePreAuthorization,
  serializeTreatmentEstimate,
} from "@/lib/insurance/serialize-estimate";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { tenantWhere } from "@/lib/tenant/scoped";

const PRE_AUTH_DECISION_STATUSES = [
  "APPROVED",
  "PARTIALLY_APPROVED",
  "DENIED",
] as const;

async function getEstimateOrThrow(tenantId: string, estimateId: string) {
  const estimate = await db.treatmentEstimate.findFirst({
    where: tenantWhere(tenantId, { id: estimateId }),
    include: {
      patient: { select: { firstName: true, lastName: true } },
      policy: { include: { provider: true } },
    },
  });
  if (!estimate) throw new Error("Treatment estimate not found");
  return estimate;
}

async function getPreAuthOrThrow(tenantId: string, preAuthId: string) {
  const preAuth = await db.preAuthorization.findFirst({
    where: tenantWhere(tenantId, { id: preAuthId }),
  });
  if (!preAuth) throw new Error("Pre-authorization not found");
  return preAuth;
}

function buildProcedureSnapshot(
  items: Array<{
    procedureCode: string | null;
    description: string;
    totalCost: unknown;
  }>,
  procedureCodes?: string[],
): ProcedureCodeSnapshot[] {
  if (procedureCodes?.length) {
    return items
      .filter(
        (item) =>
          !item.procedureCode || procedureCodes.includes(item.procedureCode),
      )
      .map((item) => ({
        code: item.procedureCode ?? "",
        description: item.description,
        amount: Number(item.totalCost ?? 0),
      }));
  }
  return items.map((item) => ({
    code: item.procedureCode ?? "",
    description: item.description,
    amount: Number(item.totalCost ?? 0),
  }));
}

export async function generateTreatmentEstimate(
  patientId: string,
  treatmentPlanId: string | null,
  procedureCodes?: string[],
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.write);

  const patient = await db.patient.findFirst({
    where: tenantWhere(ctx.tenantId, { id: patientId, deletedAt: null }),
  });
  if (!patient) throw new Error("Patient not found");

  let items: Array<{
    procedureCode: string | null;
    description: string;
    totalCost: unknown;
  }> = [];
  const planId = treatmentPlanId;

  if (treatmentPlanId) {
    const plan = await db.treatmentPlan.findFirst({
      where: tenantWhere(ctx.tenantId, { id: treatmentPlanId, deletedAt: null }),
      include: { items: true },
    });
    if (!plan) throw new Error("Treatment plan not found");
    if (plan.patientId !== patientId) throw new Error("Plan does not belong to patient");
    items = plan.items;
  } else if (procedureCodes?.length) {
    items = procedureCodes.map((code) => ({
      procedureCode: code,
      description: code,
      totalCost: 0,
    }));
  } else {
    throw new Error("Treatment plan or procedure codes are required");
  }

  const snapshot = buildProcedureSnapshot(items, procedureCodes);
  const codes = snapshot.map((p) => p.code).filter(Boolean);
  const totalAmount = snapshot.reduce((sum, p) => sum + p.amount, 0);

  const split = await calculateInsuranceSplit({
    tenantId: ctx.tenantId,
    patientId,
    procedureCodes: codes,
    totalAmount,
  });

  const insurerAmount = split?.insurerAmount ?? 0;
  const patientAmount = split?.patientAmount ?? totalAmount;
  const policyId = split?.policyId ?? null;

  const estimate = await db.treatmentEstimate.create({
    data: {
      tenantId: ctx.tenantId,
      patientId,
      treatmentPlanId: planId,
      policyId,
      procedureCodes: snapshot,
      totalAmount,
      estimatedInsurerAmount: insurerAmount,
      estimatedPatientAmount: patientAmount,
      generatedBy: ctx.staffMember?.id ?? ctx.authUserId,
    },
  });

  if (planId) {
    await db.treatmentPlan.update({
      where: { id: planId },
      data: {
        totalEstimate: totalAmount,
        insuranceEstimate: insurerAmount,
        patientEstimate: patientAmount,
      },
    });
    revalidatePath(`/clinical/treatment-plans/${planId}`);
  }
  revalidatePath(`/patients/${patientId}`);

  return {
    estimate: serializeTreatmentEstimate(estimate),
    split: split
      ? {
          totalAmount: split.totalAmount,
          insurerAmount: split.insurerAmount,
          patientAmount: split.patientAmount,
          coPayPercent: split.coPayPercent,
          preAuthRequired: split.preAuthRequired,
          providerName: split.providerName,
          networkName: split.networkName,
          policyId: split.policyId,
        }
      : {
          totalAmount,
          insurerAmount: 0,
          patientAmount: totalAmount,
          coPayPercent: 100,
          preAuthRequired: false,
          providerName: "Self-pay",
          networkName: "",
          policyId: null,
        },
  };
}

export async function createPreAuthorization(estimateId: string, policyId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.write);

  const estimate = await getEstimateOrThrow(ctx.tenantId, estimateId);
  const policy = await db.patientInsurancePolicy.findFirst({
    where: tenantWhere(ctx.tenantId, { id: policyId, isActive: true }),
  });
  if (!policy) throw new Error("Insurance policy not found");
  if (policy.patientId !== estimate.patientId) {
    throw new Error("Policy does not belong to this patient");
  }

  const preAuth = await db.preAuthorization.create({
    data: {
      tenantId: ctx.tenantId,
      estimateId,
      policyId,
      createdBy: ctx.staffMember?.id ?? ctx.authUserId,
    },
  });

  if (estimate.treatmentPlanId) {
    revalidatePath(`/clinical/treatment-plans/${estimate.treatmentPlanId}`);
  }
  revalidatePath(`/patients/${estimate.patientId}`);

  return serializePreAuthorization(preAuth);
}

export async function submitPreAuthorization(preAuthId: string, referenceNumber: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.write);

  const preAuth = await getPreAuthOrThrow(ctx.tenantId, preAuthId);
  if (preAuth.status !== "DRAFT") {
    throw new Error("Only draft pre-authorizations can be submitted");
  }
  if (!referenceNumber.trim()) {
    throw new Error("Reference number is required");
  }

  const updated = await db.preAuthorization.update({
    where: { id: preAuthId },
    data: {
      status: "SUBMITTED",
      referenceNumber: referenceNumber.trim(),
      submittedAt: new Date(),
    },
  });

  await revalidatePreAuthPaths(ctx.tenantId, preAuthId);
  return serializePreAuthorization(updated);
}

export async function recordPreAuthDecision(
  preAuthId: string,
  status: (typeof PRE_AUTH_DECISION_STATUSES)[number],
  approvedAmounts?: { insurerAmount?: number; patientAmount?: number },
  denialReason?: string,
) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.write);

  const parsed = z.enum(PRE_AUTH_DECISION_STATUSES).safeParse(status);
  if (!parsed.success) throw new Error("Invalid pre-authorization status");

  const preAuth = await getPreAuthOrThrow(ctx.tenantId, preAuthId);
  if (preAuth.status !== "SUBMITTED") {
    throw new Error("Only submitted pre-authorizations can receive a decision");
  }

  const updated = await db.preAuthorization.update({
    where: { id: preAuthId },
    data: {
      status: parsed.data as PreAuthStatus,
      decisionAt: new Date(),
      approvedInsurerAmount: approvedAmounts?.insurerAmount ?? null,
      approvedPatientAmount: approvedAmounts?.patientAmount ?? null,
      denialReason: parsed.data === "DENIED" ? denialReason?.trim() ?? null : null,
    },
  });

  await revalidatePreAuthPaths(ctx.tenantId, preAuthId);
  return serializePreAuthorization(updated);
}

export async function generateEstimatePdf(estimateId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.read);

  const estimate = await getEstimateOrThrow(ctx.tenantId, estimateId);
  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: {
      name: true,
      address: true,
      countryCode: true,
    },
  });
  if (!tenant) throw new Error("Tenant not found");

  const procedures = estimate.procedureCodes as ProcedureCodeSnapshot[];
  const pdfBytes = await buildEstimatePdfBytes({
    clinicName: tenant.name,
    clinicAddress: tenant.address ?? undefined,
    patientName: `${estimate.patient.firstName} ${estimate.patient.lastName}`,
    providerName: estimate.policy?.provider?.name ?? estimate.policy?.providerNameFreeText ?? undefined,
    networkName: estimate.policy?.networkTier ?? undefined,
    procedures,
    totalAmount: Number(estimate.totalAmount),
    insurerAmount: Number(estimate.estimatedInsurerAmount),
    patientAmount: Number(estimate.estimatedPatientAmount),
    countryCode: tenant.countryCode ?? "AE",
    generatedAt: estimate.generatedAt,
  });

  const dir = path.join(
    process.cwd(),
    "public",
    "generated",
    "estimates",
    ctx.tenantId,
  );
  await mkdir(dir, { recursive: true });
  const fileName = `${estimateId}.pdf`;
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, pdfBytes);

  const pdfUrl = `/generated/estimates/${ctx.tenantId}/${fileName}`;
  const updated = await db.treatmentEstimate.update({
    where: { id: estimateId },
    data: { pdfUrl },
  });

  if (estimate.treatmentPlanId) {
    revalidatePath(`/clinical/treatment-plans/${estimate.treatmentPlanId}`);
  }

  return {
    pdfUrl,
    estimate: serializeTreatmentEstimate(updated),
  };
}

export async function getTreatmentPlanEstimateData(treatmentPlanId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.read);

  const [latestEstimate, latestPreAuth, plan] = await Promise.all([
    db.treatmentEstimate.findFirst({
      where: tenantWhere(ctx.tenantId, { treatmentPlanId }),
      orderBy: { generatedAt: "desc" },
    }),
    db.preAuthorization.findFirst({
      where: {
        tenantId: ctx.tenantId,
        estimate: { treatmentPlanId },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.treatmentPlan.findFirst({
      where: tenantWhere(ctx.tenantId, { id: treatmentPlanId }),
      select: { patientId: true },
    }),
  ]);

  const policies = plan
    ? await db.patientInsurancePolicy.findMany({
        where: {
          tenantId: ctx.tenantId,
          patientId: plan.patientId,
          isActive: true,
        },
        include: { provider: true },
        orderBy: { rank: "asc" },
      })
    : [];

  return {
    estimate: latestEstimate ? serializeTreatmentEstimate(latestEstimate) : null,
    preAuth: latestPreAuth ? serializePreAuthorization(latestPreAuth) : null,
    policies: policies.map((p) => ({
      id: p.id,
      rank: p.rank,
      memberId: p.memberId,
      providerName: p.provider?.name ?? p.providerNameFreeText ?? "Unknown",
    })),
    preAuthDefaultRequired: isPreAuthDefaultRequired(ctx.tenant.countryCode ?? "AE"),
  };
}

export async function getPatientTreatmentPlanPreAuths(patientId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.read);

  const preAuths = await db.preAuthorization.findMany({
    where: {
      tenantId: ctx.tenantId,
      estimate: { patientId },
    },
    include: {
      estimate: { select: { treatmentPlanId: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byPlan = new Map<string, ReturnType<typeof serializePreAuthorization>>();
  for (const pa of preAuths) {
    const planId = pa.estimate?.treatmentPlanId;
    if (planId && !byPlan.has(planId)) {
      byPlan.set(planId, serializePreAuthorization(pa));
    }
  }
  return Object.fromEntries(byPlan);
}

async function revalidatePreAuthPaths(tenantId: string, preAuthId: string) {
  const preAuth = await db.preAuthorization.findFirst({
    where: { id: preAuthId, tenantId },
    include: { estimate: { select: { treatmentPlanId: true, patientId: true } } },
  });
  if (preAuth?.estimate?.treatmentPlanId) {
    revalidatePath(`/clinical/treatment-plans/${preAuth.estimate.treatmentPlanId}`);
  }
  if (preAuth?.estimate?.patientId) {
    revalidatePath(`/patients/${preAuth.estimate.patientId}`);
  }
}
