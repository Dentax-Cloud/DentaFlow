import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenant/context";
import { can, type Action, type Resource } from "./permissions";
import { getRoleHomePath } from "./routes";

export async function requireRouteAccess(resource: Resource, action: Action = "read") {
  const ctx = await requireTenantContext();
  if (!can(ctx.user.role, action, resource)) {
    redirect(getRoleHomePath(ctx.user.role));
  }
  return ctx;
}
