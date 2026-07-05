import { requireTenantContext } from "@/lib/tenant/context";
import { hasPermission, type PermissionKey } from "./permissions";
import { requireStaffMemberRole } from "./staff-role";

export async function requirePermission(permission: PermissionKey) {
  const ctx = await requireTenantContext();
  let role;
  try {
    role = requireStaffMemberRole(ctx);
  } catch {
    throw new Error("FORBIDDEN");
  }
  if (!hasPermission(role, permission)) {
    throw new Error("FORBIDDEN");
  }
  return ctx;
}
