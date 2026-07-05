"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCountryProfile } from "@/lib/countries";
import { deriveInsuranceProviderCode } from "@/lib/insurance/provider-code";
import type { Prisma } from "@prisma/client";

async function requireAdminWritePermission() {
  await requirePermission(PERMISSIONS.admin.write);
}

async function requireAdminReadPermission() {
  await requirePermission(PERMISSIONS.admin.read);
}

export async function getTenantInsuranceProviders() {
  const ctx = await requireTenantContext();
  const profile = getCountryProfile(ctx.tenant.countryCode ?? "AE");

  const custom = await db.tenantInsuranceProvider.findMany({
    where: { tenantId: ctx.tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const platformProviders = profile.insuranceProviders.map((p) => ({
    id: `platform_${p.code}`,
    code: p.code,
    name: p.name,
    nameAr: p.nameAr,
    shortName: p.shortName,
    isCustom: false,
    isActive: true,
    requiresPreAuth: p.requiresPreAuth,
    networkTypes: p.networkTypes,
    source: "platform" as const,
  }));

  const customProviders = custom.map((c) => ({
    ...c,
    networkTypes: c.networkTypes as Array<{
      code: string;
      name: string;
      defaultCoPayPercent: number;
    }>,
    source: "tenant" as const,
  }));

  return { platformProviders, customProviders };
}

export async function addCustomInsuranceProvider(input: {
  name: string;
  nameAr?: string;
  shortName: string;
  requiresPreAuth: boolean;
  claimEmail?: string;
  contactPhone?: string;
  notes?: string;
  networkTypes: Array<{
    code: string;
    name: string;
    defaultCoPayPercent: number;
  }>;
}) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  const code = deriveInsuranceProviderCode(input.name);
  if (!code) {
    throw new Error("Provider name must contain letters or numbers");
  }

  if (input.networkTypes.length === 0) {
    throw new Error("Add at least one network type");
  }

  const existing = await db.tenantInsuranceProvider.findFirst({
    where: { tenantId: ctx.tenantId, code },
  });
  if (existing) {
    throw new Error(`A provider with code "${code}" already exists`);
  }

  const maxOrder = await db.tenantInsuranceProvider.aggregate({
    where: { tenantId: ctx.tenantId },
    _max: { sortOrder: true },
  });

  await db.tenantInsuranceProvider.create({
    data: {
      tenantId: ctx.tenantId,
      countryCode: ctx.tenant.countryCode ?? "AE",
      code,
      name: input.name.trim(),
      nameAr: input.nameAr?.trim() || null,
      shortName: input.shortName.trim(),
      isCustom: true,
      isActive: true,
      requiresPreAuth: input.requiresPreAuth,
      claimEmail: input.claimEmail?.trim() || null,
      contactPhone: input.contactPhone?.trim() || null,
      notes: input.notes?.trim() || null,
      networkTypes: input.networkTypes.map((n) => ({
        code: n.code.toUpperCase().trim(),
        name: n.name.trim(),
        defaultCoPayPercent: Math.min(100, Math.max(0, n.defaultCoPayPercent)),
      })),
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/admin/customization");
}

export async function updateInsuranceProvider(
  id: string,
  data: Partial<{
    name: string;
    nameAr: string;
    shortName: string;
    requiresPreAuth: boolean;
    claimEmail: string;
    contactPhone: string;
    notes: string;
    networkTypes: Array<{ code: string; name: string; defaultCoPayPercent: number }>;
    isActive: boolean;
  }>,
) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  const payload = { ...data };
  if (payload.networkTypes) {
    if (payload.networkTypes.length === 0) {
      throw new Error("Add at least one network type");
    }
    payload.networkTypes = payload.networkTypes.map((n) => ({
      code: n.code.toUpperCase().trim(),
      name: n.name.trim(),
      defaultCoPayPercent: Math.min(100, Math.max(0, n.defaultCoPayPercent)),
    }));
  }

  await db.tenantInsuranceProvider.updateMany({
    where: { id, tenantId: ctx.tenantId, isCustom: true },
    data: payload,
  });

  revalidatePath("/admin/customization");
}

export async function deleteCustomInsuranceProvider(id: string) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  await db.tenantInsuranceProvider.updateMany({
    where: { id, tenantId: ctx.tenantId, isCustom: true },
    data: { isActive: false },
  });

  revalidatePath("/admin/customization");
}

export async function upsertFeeSchedule(input: {
  providerCode: string;
  networkType?: string;
  procedureCode: string;
  insurerFee: number;
  patientFee: number;
  coPayPercent?: number;
  notes?: string;
}) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  const existing = await db.insuranceFeeSchedule.findFirst({
    where: {
      tenantId: ctx.tenantId,
      providerCode: input.providerCode,
      procedureCode: input.procedureCode,
      networkType: input.networkType ?? null,
    },
  });

  if (existing) {
    await db.insuranceFeeSchedule.update({
      where: { id: existing.id },
      data: {
        insurerFee: input.insurerFee,
        patientFee: input.patientFee,
        coPayPercent: input.coPayPercent ?? null,
        notes: input.notes ?? null,
      },
    });
  } else {
    await db.insuranceFeeSchedule.create({
      data: {
        tenantId: ctx.tenantId,
        providerCode: input.providerCode,
        networkType: input.networkType ?? null,
        procedureCode: input.procedureCode,
        insurerFee: input.insurerFee,
        patientFee: input.patientFee,
        coPayPercent: input.coPayPercent ?? null,
        notes: input.notes ?? null,
      },
    });
  }

  revalidatePath("/admin/customization");
}

export async function getFeeSchedules(providerCode?: string) {
  await requireAdminReadPermission();
  const ctx = await requireTenantContext();

  return db.insuranceFeeSchedule.findMany({
    where: {
      tenantId: ctx.tenantId,
      ...(providerCode ? { providerCode } : {}),
    },
    orderBy: [{ providerCode: "asc" }, { procedureCode: "asc" }],
  });
}

export async function getCustomFields(entity = "PATIENT") {
  await requireAdminReadPermission();
  const ctx = await requireTenantContext();

  return db.tenantCustomField.findMany({
    where: { tenantId: ctx.tenantId, entity, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function createCustomField(input: {
  entity: string;
  fieldKey: string;
  fieldLabel: string;
  fieldLabelAr?: string;
  fieldType: string;
  isRequired: boolean;
  isPortalVisible: boolean;
  options?: Array<{ value: string; label: string }>;
  helpText?: string;
  section: string;
}) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  const safeKey = input.fieldKey
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/^_+|_+$/g, "");

  const existing = await db.tenantCustomField.findFirst({
    where: {
      tenantId: ctx.tenantId,
      entity: input.entity,
      fieldKey: safeKey,
    },
  });
  if (existing) {
    throw new Error(`Field key "${safeKey}" already exists`);
  }

  const maxOrder = await db.tenantCustomField.aggregate({
    where: { tenantId: ctx.tenantId, entity: input.entity },
    _max: { sortOrder: true },
  });

  await db.tenantCustomField.create({
    data: {
      tenantId: ctx.tenantId,
      entity: input.entity,
      fieldKey: safeKey,
      fieldLabel: input.fieldLabel,
      fieldLabelAr: input.fieldLabelAr ?? null,
      fieldType: input.fieldType,
      isRequired: input.isRequired,
      isPortalVisible: input.isPortalVisible,
      options: input.options ? (input.options as Prisma.InputJsonValue) : undefined,
      helpText: input.helpText ?? null,
      section: input.section,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/admin/customization");
}

export async function updateCustomField(
  id: string,
  data: Partial<{
    fieldLabel: string;
    fieldLabelAr: string;
    isRequired: boolean;
    isPortalVisible: boolean;
    isActive: boolean;
    options: Array<{ value: string; label: string }>;
    helpText: string;
    sortOrder: number;
  }>,
) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  await db.tenantCustomField.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data,
  });

  revalidatePath("/admin/customization");
}

export async function deleteCustomField(id: string) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  await db.tenantCustomField.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: { isActive: false },
  });

  revalidatePath("/admin/customization");
}

export async function getMembershipPlans() {
  await requireAdminReadPermission();
  const ctx = await requireTenantContext();
  return db.membershipPlan.findMany({
    where: { tenantId: ctx.tenantId, isActive: true },
    include: { _count: { select: { members: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function createMembershipPlan(input: {
  name: string;
  description?: string;
  price: number;
  duration: string;
  discountPercent: number;
  includedServices?: Array<{ procedureCode: string; qty: number }>;
}) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();
  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: { currency: true },
  });

  await db.membershipPlan.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      description: input.description ?? null,
      price: input.price,
      currency: tenant?.currency ?? "AED",
      duration: input.duration,
      discountPercent: input.discountPercent,
      includedServices: input.includedServices
        ? (input.includedServices as Prisma.InputJsonValue)
        : undefined,
    },
  });

  revalidatePath("/admin/customization");
}

export async function assignMembership(input: {
  patientId: string;
  planId: string;
  startDate: string;
  paidAmount: number;
}) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  const plan = await db.membershipPlan.findFirst({
    where: { id: input.planId, tenantId: ctx.tenantId },
  });
  if (!plan) throw new Error("Plan not found");

  const startDate = new Date(input.startDate);
  const endDate = new Date(startDate);
  if (plan.duration === "ANNUAL") {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  await db.patientMembership.create({
    data: {
      tenantId: ctx.tenantId,
      patientId: input.patientId,
      planId: input.planId,
      startDate,
      endDate,
      status: "ACTIVE",
      paidAmount: input.paidAmount,
    },
  });

  revalidatePath("/patients");
}

export async function getCorporateAccounts() {
  await requireAdminReadPermission();
  const ctx = await requireTenantContext();
  return db.corporateAccount.findMany({
    where: { tenantId: ctx.tenantId, isActive: true },
    include: { _count: { select: { patients: true } } },
    orderBy: { companyName: "asc" },
  });
}

export async function createCorporateAccount(input: {
  companyName: string;
  companyNameAr?: string;
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
  billingEmail?: string;
  discountPercent: number;
  insuranceCode?: string;
  invoicingCycle: string;
  notes?: string;
}) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  await db.corporateAccount.create({
    data: {
      tenantId: ctx.tenantId,
      ...input,
      companyNameAr: input.companyNameAr ?? null,
    },
  });

  revalidatePath("/admin/customization");
}

export async function linkPatientToCorporate(
  patientId: string,
  corporateAccountId: string,
) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  await db.patient.update({
    where: { id: patientId, tenantId: ctx.tenantId },
    data: { corporateAccountId },
  });
}

export async function getPaymentMethods() {
  await requireAdminReadPermission();
  const ctx = await requireTenantContext();
  return db.tenantPaymentMethod.findMany({
    where: { tenantId: ctx.tenantId, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
}

export async function addPaymentMethod(input: {
  name: string;
  type: string;
  config?: Record<string, string>;
}) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  const maxOrder = await db.tenantPaymentMethod.aggregate({
    where: { tenantId: ctx.tenantId },
    _max: { sortOrder: true },
  });

  await db.tenantPaymentMethod.create({
    data: {
      tenantId: ctx.tenantId,
      name: input.name,
      type: input.type,
      config: input.config ? (input.config as Prisma.InputJsonValue) : undefined,
      sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  revalidatePath("/admin/customization");
}

export async function getReferralContacts() {
  await requireAdminReadPermission();
  const ctx = await requireTenantContext();
  return db.referralContact.findMany({
    where: { tenantId: ctx.tenantId, isActive: true },
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
}

export async function addReferralContact(input: {
  type: string;
  name: string;
  specialty?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}) {
  await requireAdminWritePermission();
  const ctx = await requireTenantContext();

  await db.referralContact.create({
    data: { tenantId: ctx.tenantId, ...input },
  });

  revalidatePath("/admin/customization");
}
