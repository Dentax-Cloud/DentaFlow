export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { getUserTenants } from "@/lib/tenant/context";
import { SelectOrgClient } from "@/components/auth/select-org-client";

export default async function SelectOrgPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.isSuperAdmin) redirect("/superadmin/tenants");

  const tenants = await getUserTenants();

  if (tenants.length === 0) redirect("/sign-up");
  if (tenants.length === 1) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6">
      <SelectOrgClient
        clinics={tenants.map((tenant) => ({
          id: tenant.id,
          name: tenant.name,
          slug: tenant.slug,
          logoUrl: tenant.logoUrl,
          subscriptionPlan: tenant.subscriptionPlan,
          subscriptionStatus: tenant.subscriptionStatus,
          status: tenant.status,
          role: tenant.role,
        }))}
      />
    </div>
  );
}
