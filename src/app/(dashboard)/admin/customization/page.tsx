export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getCountryProfile } from "@/lib/countries";
import { db } from "@/lib/db";
import CustomizationClient from "./customization-client";

export default async function CustomizationPage() {
  const ctx = await requireRouteAccess("admin", "read");

  const tenant = await db.tenant.findUnique({
    where: { id: ctx.tenantId },
    select: {
      countryCode: true,
      currency: true,
      taxName: true,
      taxRate: true,
      regulatoryBody: true,
      name: true,
    },
  });

  const profile = getCountryProfile(tenant?.countryCode ?? "AE");

  const [
    customFields,
    customProviders,
    membershipPlans,
    corporateAccounts,
    paymentMethods,
    referralContacts,
    procedures,
  ] = await Promise.all([
    db.tenantCustomField.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      orderBy: { sortOrder: "asc" },
    }),
    db.tenantInsuranceProvider.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { sortOrder: "asc" },
    }),
    db.membershipPlan.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      include: { _count: { select: { members: true } } },
    }),
    db.corporateAccount.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      include: { _count: { select: { patients: true } } },
    }),
    db.tenantPaymentMethod.findMany({
      where: { tenantId: ctx.tenantId },
      orderBy: { sortOrder: "asc" },
    }),
    db.referralContact.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
    }),
    db.procedureCatalog.findMany({
      where: { tenantId: ctx.tenantId, isActive: true },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <CustomizationClient
      tenant={
        tenant
          ? {
              countryCode: tenant.countryCode,
              currency: tenant.currency,
              taxName: tenant.taxName,
              taxRate: Number(tenant.taxRate ?? 0),
              regulatoryBody: tenant.regulatoryBody,
              name: tenant.name,
            }
          : null
      }
      countryProfile={{
        flag: profile.flag,
        name: profile.name,
      }}
      customFields={customFields}
      platformProviders={profile.insuranceProviders}
      customProviders={customProviders.map((p) => ({
        ...p,
        networkTypes: p.networkTypes as Array<{
          code: string;
          name: string;
          defaultCoPayPercent: number;
        }>,
      }))}
      membershipPlans={membershipPlans.map((p) => ({
        ...p,
        price: Number(p.price),
        discountPercent: Number(p.discountPercent),
      }))}
      corporateAccounts={corporateAccounts.map((a) => ({
        ...a,
        discountPercent: Number(a.discountPercent),
      }))}
      paymentMethods={paymentMethods}
      referralContacts={referralContacts}
      procedures={procedures}
    />
  );
}
