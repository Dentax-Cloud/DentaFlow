import Link from "next/link";
import { Button } from "@/components/ui/button";
import { listTenantsWithStats } from "@/lib/super-admin/queries";
import { TenantDataTable } from "@/components/super-admin/tenants/tenant-data-table";

export const runtime = "nodejs";

type Props = {
  searchParams: Promise<{ status?: string }>;
};

export default async function SuperadminTenantsPage({ searchParams }: Props) {
  const { status } = await searchParams;
  const tenants = await listTenantsWithStats();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">Tenants</h2>
          <p className="text-sm text-zinc-400">
            Search, filter, and manage subscription plans and status across all clinics.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/superadmin">Platform overview</Link>
        </Button>
      </div>

      <TenantDataTable tenants={tenants} initialStatus={status} />
    </div>
  );
}
