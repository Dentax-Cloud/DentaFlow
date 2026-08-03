"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { checkPatientLimit, requireActiveSubscription } from "@/lib/features/gate";
import { generatePatientNumber } from "@/lib/utils";
import { generatePatientId } from "@/lib/ids/generate-ids";
import { getStaffActor, requireTenantContext } from "@/lib/tenant/context";
import { AuditAction } from "@prisma/client";
import { createPatientSchema, updatePatientSchema } from "./schemas";
import { buildPatientFormFields } from "@/lib/countries/patient-form-config";
import {
  extractCustomFieldValues,
  mapDynamicFormToPatientData,
} from "@/lib/tenant/sync-country-profile";
import { sendPatientWelcomeEmail } from "@/lib/email/send-patient-welcome";

export async function getPatientFormFieldsForTenant(countryCode: string) {
  const ctx = await requireTenantContext();
  return buildPatientFormFields(ctx.tenantId, countryCode);
}

const createPatientDynamicSchema = z.object({
  values: z.record(z.string()),
});

export const createPatientDynamic = createAction({
  schema: createPatientDynamicSchema,
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    await requireActiveSubscription();
    if (!ctx.isSuperAdmin) {
      await checkPatientLimit(ctx.tenant.id);
    }

    const countryCode = ctx.tenant.countryCode ?? "AE";
    const mapped = mapDynamicFormToPatientData(input.values, countryCode);
    if (!mapped.firstName?.trim() || !mapped.lastName?.trim()) {
      throw new Error("First and last name are required");
    }

    const count = await db.patient.count({ where: { tenantId: ctx.tenant.id } });
    const branch = await db.branch.findFirst({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      orderBy: { isPrimary: "desc" },
    });
    if (!branch) throw new Error("No active branch found");

    const { patientId, patientSeq, branchCode } = await generatePatientId(branch.id);

    const patient = await db.patient.create({
      data: {
        tenantId: ctx.tenant.id,
        patientNumber: generatePatientNumber(count + 1),
        patientId,
        branchSeq: patientSeq,
        branchCode,
        firstName: mapped.firstName as string,
        lastName: mapped.lastName as string,
        fatherName: mapped.fatherName as string | undefined,
        grandfatherName: mapped.grandfatherName as string | undefined,
        email: mapped.email as string | undefined,
        phone: mapped.phone as string | undefined,
        dateOfBirth: mapped.dateOfBirth as Date | undefined,
        gender: mapped.gender as string | undefined,
        nationality: mapped.nationality as string | undefined,
        maritalStatus: mapped.maritalStatus as string | undefined,
        occupation: mapped.occupation as string | undefined,
        employer: mapped.employer as string | undefined,
        bloodGroup: mapped.bloodGroup as string | undefined,
        countryCode,
        idDocumentType: mapped.idDocumentType as string | undefined,
        idDocumentNumber: mapped.idDocumentNumber as string | undefined,
        idDocumentExpiry: mapped.idDocumentExpiry as Date | undefined,
        insuranceProvider: mapped.insuranceProvider as string | undefined,
        insuranceNetwork: mapped.insuranceNetwork as string | undefined,
        insurancePolicyNo: mapped.insurancePolicyNo as string | undefined,
        insuranceMemberId: mapped.insuranceMemberId as string | undefined,
        insuranceExpiry: mapped.insuranceExpiry as Date | undefined,
        emergencyContactName: mapped.emergencyContactName as string | undefined,
        emergencyContactPhone: mapped.emergencyContactPhone as string | undefined,
      },
    });

    const customValues = extractCustomFieldValues(input.values);
    if (customValues.length > 0) {
      const fields = await db.tenantCustomField.findMany({
        where: {
          tenantId: ctx.tenant.id,
          entity: "PATIENT",
          fieldKey: { in: customValues.map((c) => c.fieldKey) },
        },
      });
      for (const cv of customValues) {
        const field = fields.find((f) => f.fieldKey === cv.fieldKey);
        if (!field || !cv.value) continue;
        await db.patientCustomFieldValue.create({
          data: {
            tenantId: ctx.tenant.id,
            patientId: patient.id,
            fieldId: field.id,
            value: cv.value,
          },
        });
      }
    }

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.staffMember?.id ?? ctx.user?.id,
      action: AuditAction.CREATE,
      entity: "Patient",
      entityId: patient.id,
      metadata: { patientName: `${patient.firstName} ${patient.lastName}` },
    });

    await sendPatientWelcomeEmail(ctx.tenant.id, patient);

    return patient;
  },
});

const updatePatientDynamicSchema = z.object({
  id: z.string().min(1),
  values: z.record(z.string()),
});

export const updatePatientDynamic = createAction({
  schema: updatePatientDynamicSchema,
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    const existing = await db.patient.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id, deletedAt: null }),
    });
    if (!existing) throw new Error("Patient not found");

    const countryCode = ctx.tenant.countryCode ?? "AE";
    const mapped = mapDynamicFormToPatientData(input.values, countryCode);
    if (!mapped.firstName?.trim() || !mapped.lastName?.trim()) {
      throw new Error("First and last name are required");
    }

    const patient = await db.patient.update({
      where: { id: input.id },
      data: {
        firstName: mapped.firstName as string,
        lastName: mapped.lastName as string,
        fatherName: mapped.fatherName as string | undefined,
        grandfatherName: mapped.grandfatherName as string | undefined,
        email: mapped.email as string | undefined,
        phone: mapped.phone as string | undefined,
        dateOfBirth: mapped.dateOfBirth as Date | undefined,
        gender: mapped.gender as string | undefined,
        nationality: mapped.nationality as string | undefined,
        maritalStatus: mapped.maritalStatus as string | undefined,
        occupation: mapped.occupation as string | undefined,
        employer: mapped.employer as string | undefined,
        bloodGroup: mapped.bloodGroup as string | undefined,
        idDocumentType: mapped.idDocumentType as string | undefined,
        idDocumentNumber: mapped.idDocumentNumber as string | undefined,
        idDocumentExpiry: mapped.idDocumentExpiry as Date | undefined,
        insuranceProvider: mapped.insuranceProvider as string | undefined,
        insuranceNetwork: mapped.insuranceNetwork as string | undefined,
        insurancePolicyNo: mapped.insurancePolicyNo as string | undefined,
        insuranceMemberId: mapped.insuranceMemberId as string | undefined,
        insuranceExpiry: mapped.insuranceExpiry as Date | undefined,
        emergencyContactName: mapped.emergencyContactName as string | undefined,
        emergencyContactPhone: mapped.emergencyContactPhone as string | undefined,
      },
    });

    const customValues = extractCustomFieldValues(input.values);
    if (customValues.length > 0) {
      const fields = await db.tenantCustomField.findMany({
        where: {
          tenantId: ctx.tenant.id,
          entity: "PATIENT",
          fieldKey: { in: customValues.map((c) => c.fieldKey) },
        },
      });
      for (const cv of customValues) {
        const field = fields.find((f) => f.fieldKey === cv.fieldKey);
        if (!field) continue;
        await db.patientCustomFieldValue.upsert({
          where: { patientId_fieldId: { patientId: patient.id, fieldId: field.id } },
          create: {
            tenantId: ctx.tenant.id,
            patientId: patient.id,
            fieldId: field.id,
            value: cv.value,
          },
          update: { value: cv.value },
        });
      }
    }

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.staffMember?.id ?? ctx.user?.id,
      action: AuditAction.UPDATE,
      entity: "Patient",
      entityId: patient.id,
      metadata: { patientName: `${patient.firstName} ${patient.lastName}` },
    });

    return patient;
  },
});

export const createPatient = createAction({
  schema: createPatientSchema,
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    await requireActiveSubscription();
    if (!ctx.isSuperAdmin) {
      await checkPatientLimit(ctx.tenant.id);
    }

    const count = await db.patient.count({ where: { tenantId: ctx.tenant.id } });

    const branch = await db.branch.findFirst({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      orderBy: { isPrimary: "desc" },
    });
    if (!branch) throw new Error("No active branch found");

    const { patientId, patientSeq, branchCode } = await generatePatientId(branch.id);

    try {
      const patient = await db.patient.create({
        data: {
          tenantId: ctx.tenant.id,
          patientNumber: generatePatientNumber(count + 1),
          patientId,
          branchSeq: patientSeq,
          branchCode,
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          email: input.email?.trim() || null,
          phone: input.phone?.trim() || null,
          dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
          gender: input.gender?.trim() || null,
          address: input.address?.trim() || null,
          allergies: input.allergies ?? [],
          notes: input.notes?.trim() || null,
        },
      });
      await createAuditLog({
        tenantId: ctx.tenant.id,
        userId: ctx.staffMember?.id ?? ctx.user?.id,
        action: AuditAction.CREATE,
        entity: "Patient",
        entityId: patient.id,
        metadata: { patientName: `${patient.firstName} ${patient.lastName}` },
      });
      await sendPatientWelcomeEmail(ctx.tenant.id, patient);
      return patient;
    } catch (err) {
      console.error("[createPatient]", err);
      throw err;
    }
  },
});

export const updatePatient = createAction({
  schema: updatePatientSchema,
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    const existing = await db.patient.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id }),
    });
    if (!existing) throw new Error("Patient not found");

    const patient = await db.patient.update({
      where: { id: input.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        phone: input.phone,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : undefined,
        gender: input.gender,
        address: input.address,
        allergies: input.allergies,
        notes: input.notes,
      },
    });
    return patient;
  },
});

export const deletePatient = createAction({
  schema: z.object({ id: z.string() }),
  permission: () => requirePermission(PERMISSIONS.patients.delete),
  handler: async (input, ctx) => {
    await db.patient.update({
      where: { id: input.id },
      data: { deletedAt: new Date() },
    });
    return { id: input.id };
  },
});

export const linkPatientPortalUser = createAction({
  schema: z.object({
    patientId: z.string(),
    portalUserId: z.string().min(5, "Enter a valid portal user id"),
  }),
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    const patient = await db.patient.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.patientId, deletedAt: null }),
    });
    if (!patient) throw new Error("Patient not found");

    const updated = await db.patient.update({
      where: { id: input.patientId },
      data: { portalUserId: input.portalUserId },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: getStaffActor(ctx).id,
      action: AuditAction.UPDATE,
      entity: "Patient",
      entityId: updated.id,
      metadata: { portalUserId: input.portalUserId },
    });

    return updated;
  },
});

export async function getPatients(search?: string) {
  const ctx = await requireTenantContext();
  return db.patient.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { firstName: { contains: search, mode: "insensitive" } },
              { lastName: { contains: search, mode: "insensitive" } },
              { patientNumber: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: { lastName: "asc" },
    take: 100,
  });
}

export async function getPatientById(id: string) {
  const ctx = await requireTenantContext();
  return db.patient.findFirst({
    where: tenantWhere(ctx.tenantId, { id, deletedAt: null }),
    include: {
      customFieldValues: { include: { field: true } },
      appointments: { orderBy: { startTime: "desc" }, take: 10 },
      treatmentPlans: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          items: {
            select: { id: true, status: true, totalCost: true },
          },
        },
      },
      invoices: { orderBy: { createdAt: "desc" }, take: 10 },
      teeth: { include: { conditions: { orderBy: { recordedAt: "desc" }, take: 3 } } },
      clinicalNotes: { orderBy: { visitDate: "desc" }, take: 10 },
      attachments: { where: { deletedAt: null } },
      recalls: {
        where: { status: "PENDING", completedAt: null },
        orderBy: { dueDate: "asc" },
        take: 5,
      },
    },
  });
}
