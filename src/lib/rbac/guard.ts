import { requireTenantContext } from "@/lib/tenant/context";
import { hasPermission, type PermissionKey } from "./permissions";

export async function requirePermission(permission: PermissionKey) {
  const ctx = await requireTenantContext();
  if (!ctx.staffMember || !hasPermission(ctx.staffMember.role, permission)) {
    throw new Error("FORBIDDEN");
  }
  return ctx;
}
