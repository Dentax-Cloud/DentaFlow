export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { requireStaffMemberRole } from "@/lib/rbac/staff-role";
import { listTemplates } from "@/app/(dashboard)/features/clinical/template-actions";
import { ClinicalTemplatesClient, type TemplateRow } from "./clinical-templates-client";

export default async function ClinicalTemplatesPage() {
  const ctx = await requireRouteAccess("admin", "read");
  const role = requireStaffMemberRole(ctx);
  const canEdit = hasPermission(role, PERMISSIONS.admin.write);

  const result = await listTemplates({});
  const templates = (result.success ? result.data : []) as TemplateRow[];

  return (
    <ClinicalTemplatesClient initialTemplates={templates} canEdit={canEdit} />
  );
}
