// Updated navigation.ts with Solo mode support
// (Full file is large; key additions are below)

import { isSoloMode } from "@/lib/clinic-mode";
import { SOLO_NAV_ITEMS } from "./solo-navigation";

// Add to NavFilterOptions:
export type NavFilterOptions = {
  spineEnabled?: boolean;
  clinicMode?: string | null;
};

// Update getNavGroupsForRole to accept clinicMode and return simplified groups when solo:
export function getNavGroupsForRole(
  role: UserRole,
  options: NavFilterOptions = {},
): NavGroup[] {
  if (isSoloMode(options.clinicMode)) {
    return [
      {
        label: null,
        items: SOLO_NAV_ITEMS,
      },
    ];
  }

  const spineEnabled = options.spineEnabled ?? true;
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: filterSpineItems(filterItemsForRole(role, group.items), spineEnabled),
  })).filter((group) => group.items.length > 0);
}

// Callers that have access to tenant.clinicMode should pass it in options.
