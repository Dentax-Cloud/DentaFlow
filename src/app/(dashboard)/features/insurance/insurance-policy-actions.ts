"use server";

import { z } from "zod";
import { AuditAction, PolicyRank, type Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getStaffActor, requireTenantContext } from "@/lib/tenant/context";
import { tenantWhere } from "@/lib/tenant/scoped";
import {
  DEFAULT_VERIFICATION_VALIDITY_DAYS,
  INSURANCE_VERIFICATION_STATUSES,
  POLICY_RANKS,
  SUBSCRIBER_RELATIONSHIPS,
  resolveEffectiveVerificationStatus,
  type InsuranceVerificationStatus,
} from "@/lib/insurance/policy-types";
import { serializeInsurancePolicy } from "@/lib/insurance/serialize-policy";
import { saveInsuranceCardPhotoFromUpload } from "@/lib/insurance/save-card-photo";

const policyDataSchema = z.object({
  rank: z.enum(POLICY_RANKS),
  providerId: z.string().nullable().optional(),
  providerNameFreeText: z.string().nullable().optional(),
  networkTier: z.string().nullable().optional(),
  memberId: z.string().min(1, "Member ID is required"),
  groupNumber: z.string().nullable().optional(),
  subscriberName: z.string().nullable().optional(),
  subscriberRelationship: z.enum(SUBSCRIBER_RELATIONSHIPS).nullable().optional(),
  effectiveDate: z.string().nullable().optional(),
  expiryDate: z.string().nullable().optional(),
});

function parseOptionalDate(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function resolveProviderId(
  tenantId: string,
  providerId?: string | null,
): Promise<string | null> {
  if (!providerId || providerId.startsWith("platform_")) return null;
  const provider = await db.tenantInsuranceProvider.findFirst({
    where: { id: providerId, tenantId, isActive: true },
  });
  return provider?.id ?? null;
}

async function getPolicyOrThrow(tenantId: string, policyId: string) {
  const policy = await db.patientInsurancePolicy.findFirst({
    where: tenantWhere(tenantId, { id: policyId, isActive: true }),
    include: { provider: true },
  });
  if (!policy) throw new Error("Insurance policy not found");
  return policy;
}

async function assertRankSlotAvailable(
  tenantId: string,
  patientId: string,
  rank: PolicyRank,
  excludePolicyId?: string,
) {
  const existing = await db.patientInsurancePolicy.findFirst({
    where: {
      tenantId,
      patientId,
      rank,
      isActive: true,
      ...(excludePolicyId ? { NOT: { id: excludePolicyId } } : {}),
    },
  });
  if (existing) {
    throw new Error(
      `Patient already has an active ${rank.toLowerCase()} insurance policy. Deactivate it first or edit the existing policy.`,
    );
  }
}

export async function getPatientInsurancePolicies(patientId: string) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.patients.read);
  const policies = await db.patientInsurancePolicy.findMany({
    where: tenantWhere(ctx.tenantId, { patientId, isActive: true }),
    include: { provider: true },
    orderBy: { rank: "asc" },
  });
  return policies.map((p) => serializeInsurancePolicy(p));
}

export async function getPrimaryInsuranceStatusMap(patientIds?: string[]) {
  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.patients.read);
  const policies = await db.patientInsurancePolicy.findMany({
    where: {
      tenantId: ctx.tenantId,
      isActive: true,
      rank: "PRIMARY",
      ...(patientIds?.length ? { patientId: { in: patientIds } } : {}),
    },
    select: {
      patientId: true,
      verificationStatus: true,
      verificationExpiresAt: true,
    },
  });

  const map: Record<string, InsuranceVerificationStatus> = {};
  for (const policy of policies) {
    map[policy.patientId] = resolveEffectiveVerificationStatus(
      policy.verificationStatus,
      policy.verificationExpiresAt,
    );
  }
  return map;
}

export const createInsurancePolicy = createAction({
  schema: policyDataSchema.extend({ patientId: z.string().min(1) }),
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    const patient = await db.patient.findFirst({
      where: tenantWhere(ctx.tenantId, { id: input.patientId, deletedAt: null }),
    });
    if (!patient) throw new Error("Patient not found");

    await assertRankSlotAvailable(ctx.tenantId, input.patientId, input.rank);

    const activeCount = await db.patientInsurancePolicy.count({
      where: tenantWhere(ctx.tenantId, { patientId: input.patientId, isActive: true }),
    });
    if (activeCount >= 2) {
      throw new Error("A patient can have at most two active insurance policies (primary and secondary).");
    }

    const resolvedProviderId = await resolveProviderId(ctx.tenantId, input.providerId);

    const policy = await db.patientInsurancePolicy.create({
      data: {
        tenantId: ctx.tenantId,
        patientId: input.patientId,
        rank: input.rank,
        providerId: resolvedProviderId,
        providerNameFreeText: input.providerNameFreeText?.trim() || null,
        networkTier: input.networkTier?.trim() || null,
        memberId: input.memberId.trim(),
        groupNumber: input.groupNumber?.trim() || null,
        subscriberName: input.subscriberName?.trim() || null,
        subscriberRelationship: input.subscriberRelationship ?? null,
        effectiveDate: parseOptionalDate(input.effectiveDate),
        expiryDate: parseOptionalDate(input.expiryDate),
      },
      include: { provider: true },
    });

    await createAuditLog({
      tenantId: ctx.tenantId,
      userId: getStaffActor(ctx).id,
      action: AuditAction.CREATE,
      entity: "PatientInsurancePolicy",
      entityId: policy.id,
      metadata: { patientId: input.patientId, rank: input.rank },
    });

    return serializeInsurancePolicy(policy);
  },
});

export const updateInsurancePolicy = createAction({
  schema: policyDataSchema.extend({ policyId: z.string().min(1) }),
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    const existing = await getPolicyOrThrow(ctx.tenantId, input.policyId);

    if (input.rank !== existing.rank) {
      await assertRankSlotAvailable(
        ctx.tenantId,
        existing.patientId,
        input.rank,
        input.policyId,
      );
    }

    const resolvedProviderId = await resolveProviderId(ctx.tenantId, input.providerId);

    const policy = await db.patientInsurancePolicy.update({
      where: { id: input.policyId },
      data: {
        rank: input.rank,
        providerId: resolvedProviderId,
        providerNameFreeText: input.providerNameFreeText?.trim() || null,
        networkTier: input.networkTier?.trim() || null,
        memberId: input.memberId.trim(),
        groupNumber: input.groupNumber?.trim() || null,
        subscriberName: input.subscriberName?.trim() || null,
        subscriberRelationship: input.subscriberRelationship ?? null,
        effectiveDate: parseOptionalDate(input.effectiveDate),
        expiryDate: parseOptionalDate(input.expiryDate),
      },
      include: { provider: true },
    });

    await createAuditLog({
      tenantId: ctx.tenantId,
      userId: getStaffActor(ctx).id,
      action: AuditAction.UPDATE,
      entity: "PatientInsurancePolicy",
      entityId: policy.id,
    });

    return serializeInsurancePolicy(policy);
  },
});

export const deactivateInsurancePolicy = createAction({
  schema: z.object({ policyId: z.string().min(1) }),
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    const existing = await getPolicyOrThrow(ctx.tenantId, input.policyId);

    await db.patientInsurancePolicy.update({
      where: { id: input.policyId },
      data: { isActive: false },
    });

    await createAuditLog({
      tenantId: ctx.tenantId,
      userId: getStaffActor(ctx).id,
      action: AuditAction.UPDATE,
      entity: "PatientInsurancePolicy",
      entityId: input.policyId,
      metadata: { deactivated: true, rank: existing.rank },
    });

    return { id: input.policyId };
  },
});

export const setVerificationStatus = createAction({
  schema: z.object({
    policyId: z.string().min(1),
    status: z.enum(INSURANCE_VERIFICATION_STATUSES),
  }),
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    await getPolicyOrThrow(ctx.tenantId, input.policyId);
    const staff = getStaffActor(ctx);

    const now = new Date();
    const data: Prisma.PatientInsurancePolicyUpdateInput = {
      verificationStatus: input.status,
    };

    if (input.status === "VERIFIED") {
      const expiresAt = new Date(now);
      expiresAt.setDate(expiresAt.getDate() + DEFAULT_VERIFICATION_VALIDITY_DAYS);
      data.verifiedBy = staff.id;
      data.verifiedAt = now;
      data.verificationExpiresAt = expiresAt;
    } else {
      data.verifiedBy = null;
      data.verifiedAt = null;
      data.verificationExpiresAt = null;
    }

    const policy = await db.patientInsurancePolicy.update({
      where: { id: input.policyId },
      data,
      include: { provider: true },
    });

    await createAuditLog({
      tenantId: ctx.tenantId,
      userId: staff.id,
      action: AuditAction.UPDATE,
      entity: "PatientInsurancePolicy",
      entityId: policy.id,
      metadata: { verificationStatus: input.status },
    });

    return serializeInsurancePolicy(policy);
  },
});

export const uploadInsuranceCardPhoto = createAction({
  schema: z.object({
    policyId: z.string().min(1),
    side: z.enum(["front", "back"]),
    fileUrl: z.string().url(),
  }),
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    await getPolicyOrThrow(ctx.tenantId, input.policyId);

    await saveInsuranceCardPhotoFromUpload(
      ctx.tenantId,
      input.policyId,
      input.side,
      input.fileUrl,
    );

    const updated = await db.patientInsurancePolicy.findFirst({
      where: { id: input.policyId },
      include: { provider: true },
    });
    if (!updated) throw new Error("Insurance policy not found");

    return serializeInsurancePolicy(updated);
  },
});
