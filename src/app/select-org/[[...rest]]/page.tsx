export const runtime = "nodejs";

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { getUserTenants } from "@/lib/tenant/context";

export default async function SelectOrgPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.isSuperAdmin) redirect("/superadmin/tenants");

  const tenants = await getUserTenants();

  if (tenants.length === 0) redirect("/sign-up");
  if (tenants.length === 1) redirect("/dashboard");

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-zinc-900 p-8">
        <h1 className="mb-6 text-xl font-semibold text-white">Select a clinic</h1>
        <div className="flex flex-col gap-3">
          {tenants.map((tenant) => (
            <Link
              key={tenant.id}
              href={`/api/user/tenants?switchTo=${tenant.id}`}
              className="flex items-center justify-between rounded-lg border border-white/10 bg-zinc-800 px-4 py-3 text-sm text-white transition-colors hover:bg-zinc-700"
            >
              <span className="font-medium">{tenant.name}</span>
              <span className="text-xs text-zinc-400">{tenant.role}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
