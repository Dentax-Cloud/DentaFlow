import { UserRole } from "@prisma/client";
import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenant/context";
import { can, type Action, type Resource } from "./permissions";
import { getRoleHomePath } from "./routes";

export async function requireRouteAccess(resource: Resource, action: Action = "read") {
  const ctx = await requireTenantContext();

  // staffMember may be null for owner who registered without a StaffMember record
  const role = ctx.staffMember?.role ?? ctx.user?.role ?? UserRole.OWNER;

  if (!can(role, action, resource)) {
    redirect(getRoleHomePath(role));
  }

  return ctx;
}
