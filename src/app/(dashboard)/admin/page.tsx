import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { getRolePermissions, hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { getPendingInvitations } from "@/app/(dashboard)/features/admin/actions";
import { getBranches, getAuditLogs, countAuditLogs } from "@/app/(dashboard)/features/admin/branch-actions";
import { serializeDecimal, serializeEntity, serializeMany } from "@/lib/utils/serialize";
import { AdminClient } from "./admin-client";
import { parseRecallSettings } from "@/lib/recall/helpers";
import { UserRole } from "@prisma/client";

export default async function AdminPage() {
  const ctx = await requireRouteAccess("admin", "read");

  const role = ctx.staffMember?.role ?? ctx.user?.role ?? UserRole.OWNER;
  const userId = ctx.staffMember?.id ?? ctx.user?.id ?? "";
  const canManageTeam = hasPermission(role, PERMISSIONS.admin.users);

  const [users, auditLogs, auditLogTotal, branches, settings, pendingInvitations, tenant] =
    await Promise.all([
      db.staffMember.findMany({
        where: { tenantId: ctx.tenant.id, deletedAt: null },
        orderBy: { createdAt: "desc" },
      }),
      db.auditLog.findMany({
        where: { tenantId: ctx.tenant.id },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { user: true },
      }),
      countAuditLogs(ctx.tenant.id),
      getBranches(ctx.tenant.id),
      db.settings.findUnique({ where: { tenantId: ctx.tenant.id } }),
      canManageTeam ? getPendingInvitations(ctx.tenant.id) : Promise.resolve([]),
      db.tenant.findUnique({ where: { id: ctx.tenant.id }, select: { metadata: true } }),
    ]);

  const recallSettings = parseRecallSettings(tenant?.metadata);

  return (
    <AdminClient
      users={serializeMany(users)}
      auditLogs={auditLogs.map((log) => serializeEntity(log, { user: "object" }))}
      auditLogTotal={auditLogTotal}
      branches={branches}
      settings={settings ? serializeDecimal(settings) : null}
      pendingInvitations={pendingInvitations}
      currentUserRole={role}
      currentUserId={userId}
      permissions={getRolePermissions(role)}
      recallSettings={recallSettings}
      tenantId={ctx.tenant.id}
    />
  );
}
