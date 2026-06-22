"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { AuditAction, UserRole } from "@prisma/client";
import { db } from "@/lib/db";
import { createAction, createAuditLog } from "@/lib/actions/safe-action";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { clearPendingTeamInvite, sendTeamInvite, storePendingTeamInvite } from "@/lib/tenant/team-invites";
import { checkStaffLimit, requireActiveSubscription } from "@/lib/features/gate";
import { tenantWhere } from "@/lib/tenant/scoped";
import type { RecallSettings } from "@/lib/recall/helpers";
import { DEFAULT_RECALL_SETTINGS } from "@/lib/recall/helpers";
import {
  inviteTeamMemberSchema,
  removeTeamMemberSchema,
  updateClinicSettingsSchema,
  updateTeamMemberRoleSchema,
} from "./schemas";

export const inviteTeamMember = createAction({
  schema: inviteTeamMemberSchema,
  permission: () => requirePermission(PERMISSIONS.admin.users),
  handler: async (input, ctx) => {
    await requireActiveSubscription();
    if (!ctx.isSuperAdmin) {
      await checkStaffLimit(ctx.tenant.id);
    }

    const normalizedEmail = input.email.toLowerCase();

    const existing = await db.staffMember.findFirst({
      where: {
        tenantId: ctx.tenant.id,
        email: normalizedEmail,
        deletedAt: null,
      },
    });

    if (existing) {
      throw new Error("A team member with this email already exists");
    }

    await storePendingTeamInvite(ctx.tenant.id, normalizedEmail, input.role);

    const inviterName =
      [ctx.user.firstName, ctx.user.lastName].filter(Boolean).join(" ").trim() ||
      ctx.user.email;

    await sendTeamInvite({
      tenantId: ctx.tenant.id,
      inviterName,
      email: normalizedEmail,
      role: input.role,
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.CREATE,
      entity: "TeamInvitation",
      metadata: { email: normalizedEmail, role: input.role },
    });

    revalidatePath("/admin");
    return { email: normalizedEmail, role: input.role };
  },
});

export const updateTeamMemberRole = createAction({
  schema: updateTeamMemberRoleSchema,
  permission: () => requirePermission(PERMISSIONS.admin.users),
  handler: async (input, ctx) => {
    const member = await db.staffMember.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.userId, deletedAt: null }),
    });
    if (!member) throw new Error("Team member not found");

    if (member.id === ctx.user.id) {
      throw new Error("You cannot change your own role");
    }

    if (member.role === UserRole.ADMIN || member.role === UserRole.OWNER) {
      throw new Error("Cannot change the role of an admin account");
    }

    const updated = await db.staffMember.update({
      where: { id: member.id },
      data: { role: input.role },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.UPDATE,
      entity: "User",
      entityId: member.id,
      metadata: { previousRole: member.role, newRole: input.role },
    });

    revalidatePath("/admin");
    return updated;
  },
});

export const removeTeamMember = createAction({
  schema: removeTeamMemberSchema,
  permission: () => requirePermission(PERMISSIONS.admin.users),
  handler: async (input, ctx) => {
    const member = await db.staffMember.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.userId, deletedAt: null }),
    });
    if (!member) throw new Error("Team member not found");

    if (member.id === ctx.user.id) {
      throw new Error("You cannot remove yourself");
    }

    if (member.role === UserRole.ADMIN || member.role === UserRole.OWNER) {
      throw new Error("Cannot remove an admin account");
    }

    await clearPendingTeamInvite(ctx.tenant.id, member.email);

    await db.staffMember.update({
      where: { id: member.id },
      data: { isActive: false, deletedAt: new Date() },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.DELETE,
      entity: "User",
      entityId: member.id,
      metadata: { email: member.email },
    });

    revalidatePath("/admin");
    return { id: member.id };
  },
});

export const updateClinicSettings = createAction({
  schema: updateClinicSettingsSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const settings = await db.settings.upsert({
      where: { tenantId: ctx.tenant.id },
      create: {
        tenantId: ctx.tenant.id,
        currency: input.currency,
        taxRate: input.taxRate,
        enablePatientPortal: input.enablePatientPortal,
        enableOnlinePayments: input.enableOnlinePayments,
      },
      update: {
        currency: input.currency,
        taxRate: input.taxRate,
        enablePatientPortal: input.enablePatientPortal,
        enableOnlinePayments: input.enableOnlinePayments,
      },
    });

    await createAuditLog({
      tenantId: ctx.tenant.id,
      userId: ctx.user.id,
      action: AuditAction.UPDATE,
      entity: "Settings",
      entityId: settings.id,
      metadata: {
        currency: input.currency,
        taxRate: input.taxRate,
        enablePatientPortal: input.enablePatientPortal,
        enableOnlinePayments: input.enableOnlinePayments,
      },
    });

    revalidatePath("/admin");
    return settings;
  },
});

export type PendingInvitation = {
  id: string;
  email: string;
  role: UserRole;
  createdAt: Date;
};

export async function getPendingInvitations(tenantId: string): Promise<PendingInvitation[]> {
  const tenant = await db.tenant.findUnique({ where: { id: tenantId } });
  if (!tenant) return [];

  const { listPendingTeamInvitesFromMetadata } = await import("@/lib/tenant/team-invites");
  const pending = await listPendingTeamInvitesFromMetadata(tenantId);
  return pending.map(({ email, role }) => ({
    id: `pending:${email}`,
    email,
    role,
    createdAt: tenant.updatedAt,
  }));
}

const procedureSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  category: z.string().optional(),
  durationMins: z.number().int().min(1).optional(),
  costPrice: z.number().min(0).optional(),
  sellingPrice: z.number().min(0),
  notes: z.string().optional(),
  inventoryConsumption: z
    .array(
      z.object({
        inventoryItemId: z.string(),
        quantity: z.number().int().min(1),
      }),
    )
    .optional(),
});

export const createProcedure = createAction({
  schema: procedureSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const created = await db.procedureCatalog.create({
      data: {
        tenantId: ctx.tenant.id,
        code: input.code,
        name: input.name,
        category: input.category,
        duration: input.durationMins,
        costPrice: input.costPrice,
        price: input.sellingPrice,
        description: input.notes,
        inventoryConsumption: input.inventoryConsumption?.length
          ? JSON.stringify(input.inventoryConsumption)
          : null,
      },
    });
    revalidatePath("/admin/procedure-catalog");
    return created;
  },
});

export const updateProcedure = createAction({
  schema: procedureSchema.extend({ id: z.string() }),
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const existing = await db.procedureCatalog.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id }),
    });
    if (!existing) throw new Error("Procedure not found");

    const updated = await db.procedureCatalog.update({
      where: { id: input.id },
      data: {
        code: input.code,
        name: input.name,
        category: input.category,
        duration: input.durationMins,
        costPrice: input.costPrice,
        price: input.sellingPrice,
        description: input.notes,
        inventoryConsumption: input.inventoryConsumption?.length
          ? JSON.stringify(input.inventoryConsumption)
          : null,
      },
    });
    revalidatePath("/admin/procedure-catalog");
    return updated;
  },
});

export const deleteProcedure = createAction({
  schema: z.object({ id: z.string() }),
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const existing = await db.procedureCatalog.findFirst({
      where: tenantWhere(ctx.tenant.id, { id: input.id }),
    });
    if (!existing) throw new Error("Procedure not found");

    await db.procedureCatalog.update({
      where: { id: input.id },
      data: { isActive: false },
    });
    revalidatePath("/admin/procedure-catalog");
    return { id: input.id };
  },
});

export async function listProcedures(tenantId: string) {
  return db.procedureCatalog.findMany({
    where: { tenantId, isActive: true },
    orderBy: { name: "asc" },
  });
}

const recallSettingsSchema = z.object({
  defaultIntervalMonths: z.number().int().min(1).max(24),
  autoCreateOnComplete: z.boolean(),
  reminderLeadDays: z.number().int().min(1).max(90),
});

export const saveRecallSettings = createAction({
  schema: recallSettingsSchema,
  permission: () => requirePermission(PERMISSIONS.admin.write),
  handler: async (input, ctx) => {
    const tenant = await db.tenant.findUnique({ where: { id: ctx.tenant.id } });
    const base =
      tenant?.metadata && typeof tenant.metadata === "object" && !Array.isArray(tenant.metadata)
        ? (tenant.metadata as Record<string, unknown>)
        : {};

    await db.tenant.update({
      where: { id: ctx.tenant.id },
      data: {
        metadata: {
          ...base,
          recallSettings: input as RecallSettings,
        },
      },
    });
    revalidatePath("/admin");
    return input;
  },
});
