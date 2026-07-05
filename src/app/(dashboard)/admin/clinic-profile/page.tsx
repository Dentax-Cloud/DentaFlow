import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { db } from "@/lib/db";
import { buildClinicProfileView } from "@/lib/tenant/clinic-profile";
import { getCountryProfile } from "@/lib/countries";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { requireStaffMemberRole } from "@/lib/rbac/staff-role";
import { ClinicProfileClient } from "@/components/clinic/clinic-profile-client";

export default async function ClinicProfilePage() {
  const ctx = await requireRouteAccess("admin", "read");

  const [settings, chairCount, tenantRecord] = await Promise.all([
    db.settings.findUnique({ where: { tenantId: ctx.tenant.id } }),
    db.chair.count({ where: { tenantId: ctx.tenant.id } }),
    db.tenant.findUnique({
      where: { id: ctx.tenant.id },
      select: {
        countryCode: true,
        currency: true,
        currencySymbol: true,
        taxName: true,
        taxRate: true,
        regulatoryBody: true,
        toothNumbering: true,
        workingDays: true,
      },
    }),
  ]);

  const profile = buildClinicProfileView(ctx.tenant, settings, chairCount);
  const countryProfile = getCountryProfile(tenantRecord?.countryCode ?? ctx.tenant.countryCode ?? "AE");
  const canEdit = hasPermission(requireStaffMemberRole(ctx), PERMISSIONS.admin.write);

  return (
    <ClinicProfileClient
      profile={profile}
      canEdit={canEdit}
      countryConfig={{
        code: countryProfile.code,
        flag: countryProfile.flag,
        name: countryProfile.name,
        currency: tenantRecord?.currency ?? countryProfile.currency,
        taxName: tenantRecord?.taxName ?? countryProfile.taxName,
        taxRate: Number(tenantRecord?.taxRate ?? countryProfile.taxRate),
        regulatoryBody: tenantRecord?.regulatoryBody ?? countryProfile.regulatoryBody,
        toothNumbering: tenantRecord?.toothNumbering ?? countryProfile.toothNumbering,
        workingDays: tenantRecord?.workingDays ?? countryProfile.workingDays.join(","),
      }}
    />
  );
}
