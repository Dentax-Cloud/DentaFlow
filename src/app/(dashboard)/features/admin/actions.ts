"use server";



import { clerkClient } from "@/lib/auth/stubs/server";

import { revalidatePath } from "next/cache";

import { AuditAction, UserRole } from "@prisma/client";

import { db } from "@/lib/db";

import { createAction, createAuditLog } from "@/lib/actions/safe-action";

import { requirePermission } from "@/lib/rbac/guard";

import { PERMISSIONS } from "@/lib/rbac/permissions";

import {

  dentaflowRoleMetadata,

  mapUserRoleToClerkMembershipRole,

  readDentaflowRoleFromMetadata,

  mapClerkRoleToUserRole,

} from "@/lib/tenant/clerk-roles";

import {

  clearPendingTeamInvite,

  readRoleFromClerkInvitation,

  storePendingTeamInvite,

} from "@/lib/tenant/team-invites";

import { tenantWhere } from "@/lib/tenant/scoped";

import {

  inviteTeamMemberSchema,

  removeTeamMemberSchema,

  updateClinicSettingsSchema,

  updateTeamMemberRoleSchema,

} from "./schemas";



function clerkErrorMessage(error: unknown): string {

  if (error && typeof error === "object") {

    const err = error as { status?: number; message?: string; errors?: { message?: string }[] };

    if (err.status === 404 || err.message?.toLowerCase().includes("not found")) {

      return "Organization invitation failed. Please verify your Clerk organization settings.";

    }

    const nested = err.errors?.[0]?.message;

    if (nested) return nested;

    if (err.message) return err.message;

  }

  return "Failed to send invitation";

}



export const inviteTeamMember = createAction({

  schema: inviteTeamMemberSchema,

  permission: () => requirePermission(PERMISSIONS.admin.users),

  handler: async (input, ctx) => {

    const normalizedEmail = input.email.toLowerCase();

    const existing = await db.user.findFirst({

      where: {

        tenantId: ctx.tenant.id,

        email: normalizedEmail,

        deletedAt: null,

      },

    });

    if (existing) {

      throw new Error("A team member with this email already exists");

    }



    const client = await clerkClient();

    const clerkRole = mapUserRoleToClerkMembershipRole(input.role);



    try {

      await client.organizations.createOrganizationInvitation({

        organizationId: ctx.orgId,

        emailAddress: normalizedEmail,

        role: clerkRole,

        inviterUserId: ctx.clerkUserId,

        publicMetadata: dentaflowRoleMetadata(input.role),

      });

    } catch (error) {

      throw new Error(clerkErrorMessage(error));

    }



    await storePendingTeamInvite(ctx.tenant.id, normalizedEmail, input.role);



    await createAuditLog({

      tenantId: ctx.tenant.id,

      userId: ctx.user.id,

      action: AuditAction.CREATE,

      entity: "TeamInvitation",

      metadata: { email: normalizedEmail, role: input.role, clerkRole },

    });



    revalidatePath("/admin");

    return { email: normalizedEmail, role: input.role };

  },

});



export const updateTeamMemberRole = createAction({

  schema: updateTeamMemberRoleSchema,

  permission: () => requirePermission(PERMISSIONS.admin.users),

  handler: async (input, ctx) => {

    const member = await db.user.findFirst({

      where: tenantWhere(ctx.tenant.id, { id: input.userId, deletedAt: null }),

    });

    if (!member) throw new Error("Team member not found");



    if (member.id === ctx.user.id) {

      throw new Error("You cannot change your own role");

    }



    if (member.role === UserRole.ADMIN || member.role === UserRole.OWNER) {

      throw new Error("Cannot change the role of an admin account");

    }



    const updated = await db.user.update({

      where: { id: member.id },

      data: { role: input.role },

    });



    const client = await clerkClient();

    const clerkRole = mapUserRoleToClerkMembershipRole(input.role);



    try {

      await client.organizations.updateOrganizationMembership({

        organizationId: ctx.orgId,

        userId: member.clerkUserId,

        role: clerkRole,

      });

      await client.organizations.updateOrganizationMembershipMetadata({

        organizationId: ctx.orgId,

        userId: member.clerkUserId,

        publicMetadata: dentaflowRoleMetadata(input.role),

      });

    } catch (error) {

      throw new Error(clerkErrorMessage(error));

    }



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

    const member = await db.user.findFirst({

      where: tenantWhere(ctx.tenant.id, { id: input.userId, deletedAt: null }),

    });

    if (!member) throw new Error("Team member not found");



    if (member.id === ctx.user.id) {

      throw new Error("You cannot remove yourself");

    }



    if (member.role === UserRole.ADMIN || member.role === UserRole.OWNER) {

      throw new Error("Cannot remove an admin account");

    }



    const client = await clerkClient();

    try {

      await client.organizations.deleteOrganizationMembership({

        organizationId: ctx.orgId,

        userId: member.clerkUserId,

      });

    } catch {

      // User may already be removed from Clerk org

    }



    await clearPendingTeamInvite(ctx.tenant.id, member.email);



    await db.user.update({

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



export async function getPendingInvitations(orgId: string): Promise<PendingInvitation[]> {

  const client = await clerkClient();

  const list = await client.organizations.getOrganizationInvitationList({

    organizationId: orgId,

    status: ["pending"],

  });



  return list.data.map((inv) => ({

    id: inv.id,

    email: inv.emailAddress,

    role:

      readDentaflowRoleFromMetadata(inv.publicMetadata) ??

      mapClerkRoleToUserRole(inv.role),

    createdAt: new Date(inv.createdAt),

  }));

}



export { readRoleFromClerkInvitation };


