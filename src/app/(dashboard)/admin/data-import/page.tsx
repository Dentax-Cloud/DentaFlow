import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { DataImportPanel } from "@/components/import/data-import-panel";

export default async function DataImportPage() {
  await requireRouteAccess("admin", "write");
  return <DataImportPanel />;
}
