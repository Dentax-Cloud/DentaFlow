import { requireTenantContext } from "@/lib/tenant/context";
import { hasPermission, type PermissionKey } from "./permissions";

export async function requirePermission(permission: PermissionKey) {
  const ctx = await requireTenantContext();
  if (!hasPermission(ctx.user.role, permission)) {
    throw new Error("FORBIDDEN");
  }
  return ctx;
}
