"use server";

import { z } from "zod";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { tenantWhere } from "@/lib/tenant/scoped";
import { checkPatientLimit, requireActiveSubscription } from "@/lib/features/gate";
import { AuditAction } from "@prisma/client";
import { createPatientSchema, updatePatientSchema } from "./schemas";

export const createPatient = createAction({
  schema: createPatientSchema,
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    await requireActiveSubscription();
    if (!ctx.isSuperAdmin) {
      await checkPatientLimit(ctx.tenant.id);
    }

    const count = await db.patient.count({ where: { tenantId: ctx.tenant.id } });
    const patient = await db.patient.create({
      data: {
        tenantId: ctx.tenant.id,
        patientNumber: generatePatientNumber(count + 1),
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email || null,
        phone: input.phone,
        dateOfBirth: input.dateOfBirth ? new Date(input.dateOfBirth) : null,
        gender: input.gender,
        address: input.address,
        allergies: input.allergies ?? [],
        notes: input.notes,
      },
    });
    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.CREATE,
      entity: "Patient",
      entityId: patient.id,
    });
    return patient;
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
    clerkUserId: z.string().min(5, "Enter a valid Clerk user id"),
  }),
  permission: () => requirePermission(PERMISSIONS.patients.write),
  handler: async (input, ctx) => {
    const patient = await db.patient.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.patientId, deletedAt: null }),
    });
    if (!patient) throw new Error("Patient not found");

    const updated = await db.patient.update({
      where: { id: input.patientId },
      data: { portalUserId: input.clerkUserId },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.UPDATE,
      entity: "Patient",
      entityId: updated.id,
      metadata: { portalUserId: input.clerkUserId },
    });

    return updated;
  },
});

export async function getPatients(tenantId: string, search?: string) {
  return db.patient.findMany({
    where: {
      tenantId,
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

export async function getPatientById(tenantId: string, id: string) {
  return db.patient.findFirst({
    where: tenantWhere(tenantId, { id, deletedAt: null }),
    include: {
      appointments: { orderBy: { startTime: "desc" }, take: 10 },
      treatmentPlans: { orderBy: { createdAt: "desc" }, take: 5 },
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
