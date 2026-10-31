import type { UserRole } from "@prisma/client";
import { can as baseCan, type Action, type Resource } from "./permissions";

/**
 * In solo mode the single doctor effectively has full access
 * across clinical, billing, inventory, and practice settings.
 */
export function canInSoloMode(
  role: UserRole,
  action: Action,
  resource: Resource,
  clinicMode: string | null | undefined,
): boolean {
  if (clinicMode === "solo") {
    // Solo doctor is treated as having full access for operational work.
    // Team management and multi-location remain restricted by UI hiding.
    if (resource === "team") return false;
    return true;
  }
  return baseCan(role, action, resource);
}
