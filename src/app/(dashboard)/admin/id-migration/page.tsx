import { redirect } from "next/navigation";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getIdMigrationStatus } from "@/app/(dashboard)/features/admin/id-migration-actions";
import { IdMigrationClient } from "./id-migration-client";

export const runtime = "nodejs";

export default async function IdMigrationPage() {
  const ctx = await requireRouteAccess("admin", "read");
  if (ctx.staffMember?.role !== "OWNER" && !ctx.isSuperAdmin) {
    redirect("/dashboard");
  }

  const status = await getIdMigrationStatus();

  return <IdMigrationClient initialStatus={status} />;
}
