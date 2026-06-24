export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { UserRole } from "@prisma/client";
import { listTemplates } from "@/app/(dashboard)/features/clinical/template-actions";
import { ClinicalTemplatesClient } from "./clinical-templates-client";

export default async function ClinicalTemplatesPage() {
  const ctx = await requireRouteAccess("admin", "read");
  const role = ctx.staffMember?.role ?? ctx.user?.role ?? UserRole.OWNER;
  const canEdit = hasPermission(role, PERMISSIONS.admin.write);

  const result = await listTemplates({});
  const templates = result.success ? result.data : [];

  return (
    <ClinicalTemplatesClient initialTemplates={templates} canEdit={canEdit} />
  );
}
