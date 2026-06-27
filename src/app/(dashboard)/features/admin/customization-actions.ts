"use server";

import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { getCountryProfile } from "@/lib/countries";
import type { Prisma } from "@prisma/client";

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
  code: string;
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
  const ctx = await requireTenantContext();

  await db.tenantInsuranceProvider.create({
    data: {
      tenantId: ctx.tenantId,
      countryCode: ctx.tenant.countryCode ?? "AE",
      code: input.code.toUpperCase().replace(/\s/g, "_"),
      name: input.name,
      nameAr: input.nameAr ?? null,
      shortName: input.shortName,
      isCustom: true,
      isActive: true,
      requiresPreAuth: input.requiresPreAuth,
      claimEmail: input.claimEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      notes: input.notes ?? null,
      networkTypes: input.networkTypes,
    },
  });

  revalidatePath("/admin/customization");
}

export async function updateInsuranceProvider(
  id: string,
  data: Partial<{
    name: string;
    nameAr: string;
    requiresPreAuth: boolean;
    claimEmail: string;
    notes: string;
    networkTypes: Array<{ code: string; name: string; defaultCoPayPercent: number }>;
    isActive: boolean;
  }>,
) {
  const ctx = await requireTenantContext();

  await db.tenantInsuranceProvider.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data,
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
  const ctx = await requireTenantContext();

  await db.tenantCustomField.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data,
  });

  revalidatePath("/admin/customization");
}

export async function deleteCustomField(id: string) {
  const ctx = await requireTenantContext();

  await db.tenantCustomField.updateMany({
    where: { id, tenantId: ctx.tenantId },
    data: { isActive: false },
  });

  revalidatePath("/admin/customization");
}

export async function getMembershipPlans() {
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
  const ctx = await requireTenantContext();

  await db.patient.update({
    where: { id: patientId, tenantId: ctx.tenantId },
    data: { corporateAccountId },
  });
}

export async function getPaymentMethods() {
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
  const ctx = await requireTenantContext();

  await db.referralContact.create({
    data: { tenantId: ctx.tenantId, ...input },
  });

  revalidatePath("/admin/customization");
}
