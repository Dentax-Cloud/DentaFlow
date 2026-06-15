"use server";

import { z } from "zod";
import { AuditAction } from "@prisma/client";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { getCountryByCode } from "@/lib/auth/countries";
import {
  mergeTenantMetadata,
  parseMetadataForUpdate,
  type ClinicCustomField,
} from "@/lib/tenant/clinic-profile";

const updateClinicProfileSchema = z.object({
  name: z.string().min(2, "Clinic name is required"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  logoUrl: z.string().url().optional().or(z.literal("")),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(2).optional(),
  timezone: z.string().min(1).optional(),
  locale: z.string().min(2).optional(),
  currency: z.string().min(3).optional(),
  taxId: z.string().optional(),
  specialties: z.array(z.string()).optional(),
  expectedMonthlyPatients: z.string().optional(),
  referralSource: z.string().optional(),
  doctorCount: z.coerce.number().int().min(1).max(100).optional(),
});

export const updateClinicProfile = createAction({
  schema: updateClinicProfileSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const country = input.country ? getCountryByCode(input.country) : undefined;
    const fullAddress = [
      input.addressLine1,
      input.addressLine2,
      input.city,
      input.state,
      input.postalCode,
    ]
      .filter(Boolean)
      .join(", ");

    const existingMeta = parseMetadataForUpdate(ctx.tenant.metadata);
    const metadata = mergeTenantMetadata(ctx.tenant.metadata, {
      ...existingMeta,
      currency: input.currency ?? existingMeta.currency,
      specialties: input.specialties ?? existingMeta.specialties,
      expectedMonthlyPatients:
        input.expectedMonthlyPatients ?? existingMeta.expectedMonthlyPatients,
      referralSource: input.referralSource ?? existingMeta.referralSource,
      doctorCount: input.doctorCount ?? existingMeta.doctorCount,
      addressLine1: input.addressLine1 ?? existingMeta.addressLine1,
      addressLine2: input.addressLine2 ?? existingMeta.addressLine2,
      state: input.state ?? existingMeta.state,
      postalCode: input.postalCode ?? existingMeta.postalCode,
      taxId: input.taxId ?? existingMeta.taxId,
      taxIdType: input.taxId
        ? country?.taxLabel ?? existingMeta.taxIdType ?? "Tax ID"
        : existingMeta.taxIdType,
      customFields: existingMeta.customFields,
    });

    const tenant = await db.tenant.update({
      where: { id: ctx.tenant.id },
      data: {
        name: input.name,
        email: input.email || null,
        phone: input.phone || null,
        logoUrl: input.logoUrl || null,
        address: fullAddress || null,
        city: input.city || null,
        country: input.country || ctx.tenant.country,
        timezone: input.timezone ?? ctx.tenant.timezone,
        locale: input.locale ?? ctx.tenant.locale,
        metadata,
      },
    });

    if (input.currency) {
      await db.settings.upsert({
        where: { tenantId: ctx.tenant.id },
        create: { tenantId: ctx.tenant.id, currency: input.currency },
        update: { currency: input.currency },
      });
    }

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.UPDATE,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { section: "clinic_profile" },
    });

    return tenant;
  },
});

const customFieldSchema = z.object({
  id: z.string().optional(),
  label: z.string().min(1, "Label is required").max(80),
  value: z.string().max(500),
});

export const upsertClinicCustomField = createAction({
  schema: customFieldSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const meta = parseMetadataForUpdate(ctx.tenant.metadata);
    const fields = [...(meta.customFields ?? [])];
    const id = input.id ?? crypto.randomUUID();
    const entry: ClinicCustomField = { id, label: input.label, value: input.value };
    const index = fields.findIndex((f) => f.id === id);
    if (index >= 0) {
      fields[index] = entry;
    } else {
      fields.push(entry);
    }

    const tenant = await db.tenant.update({
      where: { id: ctx.tenant.id },
      data: {
        metadata: mergeTenantMetadata(ctx.tenant.metadata, {
          ...meta,
          customFields: fields,
        }),
      },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.UPDATE,
      entity: "Tenant",
      entityId: tenant.id,
      metadata: { section: "clinic_profile_custom_field", fieldId: id },
    });

    return entry;
  },
});

export const removeClinicCustomField = createAction({
  schema: z.object({ id: z.string() }),
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const meta = parseMetadataForUpdate(ctx.tenant.metadata);
    const fields = (meta.customFields ?? []).filter((f) => f.id !== input.id);

    await db.tenant.update({
      where: { id: ctx.tenant.id },
      data: {
        metadata: mergeTenantMetadata(ctx.tenant.metadata, {
          ...meta,
          customFields: fields,
        }),
      },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.DELETE,
      entity: "Tenant",
      entityId: ctx.tenant.id,
      metadata: { section: "clinic_profile_custom_field", fieldId: input.id },
    });

    return { removed: input.id };
  },
});
