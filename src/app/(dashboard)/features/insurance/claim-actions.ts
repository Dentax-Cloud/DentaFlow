"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  AuditAction,
  ClaimDenialCategory,
  ClaimStatus,
  PolicyRank,
  type Prisma,
} from "@prisma/client";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getStaffActor } from "@/lib/tenant/context";
import { tenantWhere } from "@/lib/tenant/scoped";
import {
  CLAIM_DENIAL_CATEGORIES,
  type ClaimProcedureSnapshotLine,
} from "@/lib/insurance/claim-types";
import { serializeClaim } from "@/lib/insurance/serialize-claim";

const DECISION_STATUSES = [
  "APPROVED",
  "PARTIALLY_APPROVED",
  "DENIED",
] as const satisfies readonly ClaimStatus[];

const claimInclude = {
  policy: { include: { provider: true } },
  invoice: {
    include: {
      patient: {
        select: { id: true, firstName: true, lastName: true, patientId: true },
      },
      items: true,
    },
  },
  appealedClaim: { select: { id: true, claimNumber: true, status: true } },
  appeals: { select: { id: true, claimNumber: true, status: true } },
} satisfies Prisma.ClaimInclude;

async function getPrimaryPolicyOrThrow(tenantId: string, patientId: string) {
  const policy = await db.patientInsurancePolicy.findFirst({
    where: {
      tenantId,
      patientId,
      rank: PolicyRank.PRIMARY,
      isActive: true,
    },
    include: { provider: true },
  });
  if (!policy) {
    throw new Error(
      "Patient has no insurance policy on file — add one before submitting a claim",
    );
  }
  return policy;
}

function buildProcedureSnapshotFromInvoice(
  items: Array<{
    procedureCode: string | null;
    description: string;
    quantity: number;
    unitPrice: unknown;
    total: unknown;
  }>,
): ClaimProcedureSnapshotLine[] {
  return items.map((item) => ({
    procedureCode: item.procedureCode,
    description: item.description,
    quantity: item.quantity,
    unitPrice: Number(item.unitPrice),
    total: Number(item.total),
  }));
}

async function getClaimOrThrow(tenantId: string, claimId: string) {
  const claim = await db.claim.findFirst({
    where: tenantWhere(tenantId, { id: claimId }),
    include: claimInclude,
  });
  if (!claim) throw new Error("Claim not found");
  return claim;
}

export async function getClaims(tenantId: string) {
  const claims = await db.claim.findMany({
    where: { tenantId },
    include: claimInclude,
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return claims.map(serializeClaim);
}

export async function getClaimById(tenantId: string, claimId: string) {
  const claim = await getClaimOrThrow(tenantId, claimId);
  return serializeClaim(claim);
}

export async function getClaimableInvoices(tenantId: string) {
  const invoices = await db.invoice.findMany({
    where: {
      tenantId,
      deletedAt: null,
      insuranceAmount: { gt: 0 },
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          patientInsurancePolicies: {
            where: { rank: PolicyRank.PRIMARY, isActive: true },
            take: 1,
          },
        },
      },
      claims: {
        where: {
          status: {
            notIn: [ClaimStatus.DENIED, ClaimStatus.WRITTEN_OFF, ClaimStatus.PAID],
          },
        },
        select: { id: true, status: true },
      },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return invoices
    .filter(
      (inv) =>
        inv.patient.patientInsurancePolicies.length > 0 && inv.claims.length === 0,
    )
    .map((inv) => ({
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      patientName: `${inv.patient.firstName} ${inv.patient.lastName}`.trim(),
      patientId: inv.patient.id,
      insuranceAmount: Number(inv.insuranceAmount ?? 0),
      total: Number(inv.total),
      createdAt: inv.createdAt.toISOString(),
    }));
}

const createClaimSchema = z.object({
  invoiceId: z.string().min(1),
});

export const createClaimFromInvoice = createAction({
  schema: createClaimSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const invoice = await db.invoice.findFirst({
      where: tenantWhere(ctx.tenant.id, {
        id: input.invoiceId,
        deletedAt: null,
      }),
      include: { items: true, claims: true },
    });
    if (!invoice) throw new Error("Invoice not found");

    const insuranceAmount = Number(invoice.insuranceAmount ?? 0);
    if (insuranceAmount <= 0) {
      throw new Error("Invoice has no insurer portion — cannot create a claim");
    }

    const policy = await getPrimaryPolicyOrThrow(ctx.tenant.id, invoice.patientId);

    const activeClaim = invoice.claims.find(
      (c) =>
        c.status !== ClaimStatus.DENIED &&
        c.status !== ClaimStatus.WRITTEN_OFF &&
        c.status !== ClaimStatus.PAID,
    );
    if (activeClaim) {
      throw new Error("An active claim already exists for this invoice");
    }

    const procedureSnapshot = buildProcedureSnapshotFromInvoice(invoice.items);

    const claim = await db.claim.create({
      data: {
        tenantId: ctx.tenant.id,
        policyId: policy.id,
        invoiceId: invoice.id,
        amount: insuranceAmount,
        submittedAmount: insuranceAmount,
        status: ClaimStatus.DRAFT,
        procedureSnapshot: procedureSnapshot as unknown as Prisma.InputJsonValue,
      },
      include: claimInclude,
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.CREATE,
      entity: "Claim",
      entityId: claim.id,
      metadata: {
        invoiceId: invoice.id,
        policyId: policy.id,
        submittedAmount: insuranceAmount,
      },
    });

    revalidatePath("/billing/claims");
    revalidatePath("/billing");
    return serializeClaim(claim);
  },
});

const submitClaimSchema = z.object({
  claimId: z.string().min(1),
  referenceNumber: z.string().min(1, "Reference number is required"),
});

export const submitClaim = createAction({
  schema: submitClaimSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const existing = await getClaimOrThrow(ctx.tenant.id, input.claimId);
    if (existing.status !== ClaimStatus.DRAFT) {
      throw new Error("Only draft claims can be submitted");
    }

    const claim = await db.claim.update({
      where: { id: existing.id },
      data: {
        status: ClaimStatus.SUBMITTED,
        claimNumber: input.referenceNumber.trim(),
        submittedAt: new Date(),
      },
      include: claimInclude,
    });

    await db.invoice.update({
      where: { id: claim.invoiceId },
      data: { insuranceClaimRef: input.referenceNumber.trim() },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.UPDATE,
      entity: "Claim",
      entityId: claim.id,
      metadata: { status: ClaimStatus.SUBMITTED, referenceNumber: input.referenceNumber },
    });

    revalidatePath("/billing/claims");
    return serializeClaim(claim);
  },
});

const markInReviewSchema = z.object({
  claimId: z.string().min(1),
});

export const markClaimInReview = createAction({
  schema: markInReviewSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const existing = await getClaimOrThrow(ctx.tenant.id, input.claimId);
    if (existing.status !== ClaimStatus.SUBMITTED) {
      throw new Error("Only submitted claims can be marked in review");
    }

    const claim = await db.claim.update({
      where: { id: existing.id },
      data: { status: ClaimStatus.IN_REVIEW },
      include: claimInclude,
    });

    revalidatePath("/billing/claims");
    return serializeClaim(claim);
  },
});

const recordDecisionSchema = z.object({
  claimId: z.string().min(1),
  status: z.enum(DECISION_STATUSES),
  approvedAmount: z.number().min(0).optional(),
  denialReason: z.string().optional(),
  denialCategory: z.enum(CLAIM_DENIAL_CATEGORIES).optional(),
});

export const recordClaimDecision = createAction({
  schema: recordDecisionSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const existing = await getClaimOrThrow(ctx.tenant.id, input.claimId);
    if (
      existing.status !== ClaimStatus.SUBMITTED &&
      existing.status !== ClaimStatus.IN_REVIEW
    ) {
      throw new Error("Claim must be submitted or in review to record a decision");
    }

    const now = new Date();

    if (input.status === "DENIED") {
      const claim = await db.claim.update({
        where: { id: existing.id },
        data: {
          status: ClaimStatus.DENIED,
          decisionAt: now,
          denialReason: input.denialReason?.trim() || "Denied by insurer",
          denialCategory: input.denialCategory
            ? (input.denialCategory as ClaimDenialCategory)
            : ClaimDenialCategory.OTHER,
          approvedAmount: null,
        },
        include: claimInclude,
      });

      await createAuditLog({
        tenantId: ctx.tenant.id,
        userId: getStaffActor(ctx).id,
        action: AuditAction.UPDATE,
        entity: "Claim",
        entityId: claim.id,
        metadata: { status: ClaimStatus.DENIED, denialReason: claim.denialReason },
      });

      revalidatePath("/billing/claims");
      return serializeClaim(claim);
    }

    const approvedAmount =
      input.approvedAmount ??
      (input.status === "APPROVED" ? Number(existing.submittedAmount) : undefined);

    if (approvedAmount === undefined) {
      throw new Error("Approved amount is required for partial approvals");
    }

    if (approvedAmount > Number(existing.submittedAmount)) {
      throw new Error("Approved amount cannot exceed submitted amount");
    }

    const claim = await db.claim.update({
      where: { id: existing.id },
      data: {
        status:
          input.status === "PARTIALLY_APPROVED"
            ? ClaimStatus.PARTIALLY_APPROVED
            : ClaimStatus.APPROVED,
        decisionAt: now,
        approvedAmount,
        denialReason: null,
        denialCategory: null,
      },
      include: claimInclude,
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.UPDATE,
      entity: "Claim",
      entityId: claim.id,
      metadata: { status: claim.status, approvedAmount },
    });

    revalidatePath("/billing/claims");
    return serializeClaim(claim);
  },
});

const appealClaimSchema = z.object({
  claimId: z.string().min(1),
});

export const appealClaim = createAction({
  schema: appealClaimSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const original = await getClaimOrThrow(ctx.tenant.id, input.claimId);
    if (original.status !== ClaimStatus.DENIED) {
      throw new Error("Only denied claims can be appealed");
    }

    const appeal = await db.claim.create({
      data: {
        tenantId: ctx.tenant.id,
        policyId: original.policyId,
        invoiceId: original.invoiceId,
        appealedClaimId: original.id,
        amount: original.submittedAmount,
        submittedAmount: original.submittedAmount,
        status: ClaimStatus.DRAFT,
        procedureSnapshot: original.procedureSnapshot as Prisma.InputJsonValue,
        notes: `Appeal of claim ${original.claimNumber ?? original.id}`,
      },
      include: claimInclude,
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.CREATE,
      entity: "Claim",
      entityId: appeal.id,
      metadata: { appealedClaimId: original.id, originalStatus: original.status },
    });

    revalidatePath("/billing/claims");
    return serializeClaim(appeal);
  },
});

const markPaidSchema = z.object({
  claimId: z.string().min(1),
  paidAmount: z.number().positive(),
});

export const markClaimPaid = createAction({
  schema: markPaidSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const existing = await getClaimOrThrow(ctx.tenant.id, input.claimId);
    if (
      existing.status !== ClaimStatus.APPROVED &&
      existing.status !== ClaimStatus.PARTIALLY_APPROVED
    ) {
      throw new Error("Only approved claims can be marked paid");
    }

    const approved = Number(existing.approvedAmount ?? existing.submittedAmount);
    const variance = Math.round((input.paidAmount - approved) * 100) / 100;
    const hasVariance = Math.abs(variance) >= 0.01;

    const claim = await db.claim.update({
      where: { id: existing.id },
      data: {
        status: ClaimStatus.PAID,
        paidAmount: input.paidAmount,
        paymentVariance: hasVariance ? variance : null,
        notes: hasVariance
          ? [
              existing.notes,
              `Payment variance: paid ${input.paidAmount}, approved ${approved} (${variance >= 0 ? "+" : ""}${variance.toFixed(2)})`,
            ]
              .filter(Boolean)
              .join("\n")
          : existing.notes,
      },
      include: claimInclude,
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.UPDATE,
      entity: "Claim",
      entityId: claim.id,
      metadata: {
        status: ClaimStatus.PAID,
        paidAmount: input.paidAmount,
        approvedAmount: approved,
        variance: hasVariance ? variance : 0,
      },
    });

    revalidatePath("/billing/claims");
    return {
      claim: serializeClaim(claim),
      hasVariance,
      variance: hasVariance ? variance : 0,
      approvedAmount: approved,
    };
  },
});

const writeOffSchema = z.object({
  claimId: z.string().min(1),
  reason: z.string().min(1),
});

export const writeOffClaim = createAction({
  schema: writeOffSchema,
  permission: () => requirePermission(PERMISSIONS.billing.write),
  handler: async (input, ctx) => {
    const existing = await getClaimOrThrow(ctx.tenant.id, input.claimId);
    if (
      existing.status !== ClaimStatus.DENIED &&
      existing.status !== ClaimStatus.PARTIALLY_APPROVED
    ) {
      throw new Error("Only denied or partially approved claims can be written off");
    }

    const claim = await db.claim.update({
      where: { id: existing.id },
      data: {
        status: ClaimStatus.WRITTEN_OFF,
        notes: [existing.notes, `Written off: ${input.reason.trim()}`]
          .filter(Boolean)
          .join("\n"),
      },
      include: claimInclude,
    });

    revalidatePath("/billing/claims");
    return serializeClaim(claim);
  },
});
