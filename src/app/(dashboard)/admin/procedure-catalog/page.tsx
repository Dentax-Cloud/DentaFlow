import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { listProcedures } from "@/app/(dashboard)/features/admin/actions";
import { ProcedureCatalogClient } from "./procedure-catalog-client";

export default async function ProcedureCatalogPage() {
  const ctx = await requireRouteAccess("admin", "read");
  const procedures = await listProcedures(ctx.tenant.id);

  return <ProcedureCatalogClient initialProcedures={procedures} />;
}
