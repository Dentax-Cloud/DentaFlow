export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import {
  generateImportTemplate,
  type ImportEntity,
} from "@/lib/import/template-generator";

const VALID_ENTITIES: ImportEntity[] = ["PATIENT", "INVENTORY", "STAFF", "PROCEDURE"];

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ctx = await requireTenantContext();
  try {
    await requirePermission(PERMISSIONS.admin.read);
  } catch {
    return new Response("Forbidden", { status: 403 });
  }
  const { searchParams } = new URL(request.url);
  const raw = (searchParams.get("entity") ?? "PATIENT").toUpperCase();
  const entity = (VALID_ENTITIES.includes(raw as ImportEntity)
    ? raw
    : "PATIENT") as ImportEntity;

  const buffer = await generateImportTemplate(entity, ctx.tenantId);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="dentaflow-${entity.toLowerCase()}-import.xlsx"`,
    },
  });
}
