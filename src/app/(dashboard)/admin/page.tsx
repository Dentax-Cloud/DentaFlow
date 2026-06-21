import { requireRouteAccess } from "@/lib/rbac/require-route-access";

import { db } from "@/lib/db";

import { getRolePermissions, hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";

import { getPendingInvitations } from "@/app/(dashboard)/features/admin/actions";

import { AdminClient } from "./admin-client";



export default async function AdminPage() {

  const ctx = await requireRouteAccess("admin", "read");



  const canManageTeam = hasPermission(ctx.user.role, PERMISSIONS.admin.users);



  const [users, auditLogs, settings, pendingInvitations] = await Promise.all([

    db.staffMember.findMany({
      where: { tenantId: ctx.tenant.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
    }),

    db.auditLog.findMany({

      where: { tenantId: ctx.tenant.id },

      orderBy: { createdAt: "desc" },

      take: 50,

      include: { user: true },

    }),

    db.settings.findUnique({ where: { tenantId: ctx.tenant.id } }),

    canManageTeam ? getPendingInvitations(ctx.tenant.id) : Promise.resolve([]),

  ]);



  return (

    <AdminClient

      users={users}

      auditLogs={auditLogs}

      settings={settings}

      pendingInvitations={pendingInvitations}

      currentUserRole={ctx.user.role}

      currentUserId={ctx.user.id}

      permissions={getRolePermissions(ctx.user.role)}

    />

  );

}

