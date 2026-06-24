import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { buildClinicProfileView } from "@/lib/tenant/clinic-profile";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { UserRole } from "@prisma/client";
import { ClinicProfileClient } from "@/components/clinic/clinic-profile-client";

export default async function ClinicProfilePage() {
  const ctx = await requireRouteAccess("admin", "read");

  const [settings, chairCount] = await Promise.all([
    db.settings.findUnique({ where: { tenantId: ctx.tenant.id } }),
    db.chair.count({ where: { tenantId: ctx.tenant.id } }),
  ]);

  const profile = buildClinicProfileView(ctx.tenant, settings, chairCount);
  const canEdit = hasPermission(
    ctx.staffMember?.role ?? ctx.user?.role ?? UserRole.OWNER,
    PERMISSIONS.admin.write,
  );

  return (
    <ClinicProfileClient profile={profile} canEdit={canEdit} />
  );
}
