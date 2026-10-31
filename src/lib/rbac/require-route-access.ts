import { redirect } from "next/navigation";
import { requireTenantContext } from "@/lib/tenant/context";
import { can, type Action, type Resource } from "./permissions";
import { canInSoloMode } from "./solo-permissions";
import { getRoleHomePath } from "./routes";
import {
  ACCOUNT_SETUP_INCOMPLETE_PATH,
  requireStaffMemberRole,
} from "./staff-role";

export async function requireRouteAccess(resource: Resource, action: Action = "read") {
  const ctx = await requireTenantContext();

  let role;
  try {
    role = requireStaffMemberRole(ctx);
  } catch {
    redirect(ACCOUNT_SETUP_INCOMPLETE_PATH);
  }

  const clinicMode = (ctx.tenant as { clinicMode?: string | null }).clinicMode ?? null;
  const allowed = canInSoloMode(role, action, resource, clinicMode);

  if (!allowed) {
    redirect(getRoleHomePath(role));
  }

  return ctx;
}
