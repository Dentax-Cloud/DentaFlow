import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Wrench,
  AlertCircle,
  ScanBarcode,
  ClipboardList,
  ClipboardCheck,
  ShoppingCart,
  Timer,
  Fingerprint,
  Receipt,
  Package,
  Megaphone,
  BarChart3,
  Settings,
  Sparkles,
  CreditCard,
  Building2,
  Globe,
  CalendarPlus,
  Settings2,
  IdCard,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { can, normalizeDashboardRole, type Action, type Resource } from "./permissions";
import { isSoloMode } from "@/lib/clinic-mode";
import { SOLO_NAV_ITEMS } from "./solo-navigation";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  resource: Resource;
  action?: Action;
  matchPrefix?: boolean;
};

export type NavGroup = {
  label: string | null;
  items: NavItem[];
  defaultExpanded?: boolean;
};

const dashboardItem: NavItem = {
  href: "/dashboard",
  label: "Dashboard",
  icon: LayoutDashboard,
  resource: "reports",
  action: "read",
  matchPrefix: false,
};

const patientsItem: NavItem = {
  href: "/patients",
  label: "Patients",
  icon: Users,
  resource: "patients",
  action: "read",
};

const receptionItem: NavItem = {
  href: "/reception",
  label: "Reception",
  icon: ScanBarcode,
  resource: "appointments",
  action: "read",
};

const crmItem: NavItem = {
  href: "/crm",
  label: "CRM",
  icon: Megaphone,
  resource: "crm",
  action: "read",
};

const reportsItem: NavItem = {
  href: "/reports",
  label: "Reports",
  icon: BarChart3,
  resource: "reports",
  action: "export",
};

const aiItem: NavItem = {
  href: "/ai",
  label: "AI Assistant",
  icon: Sparkles,
  resource: "ai",
  action: "use",
};

export const MAIN_NAV_ITEMS: NavItem[] = [
  dashboardItem,
  patientsItem,
  receptionItem,
  {
    href: "/appointments",
    label: "Appointments",
    icon: Calendar,
    resource: "appointments",
    action: "read",
  },
  {
    href: "/appointments/book",
    label: "Book Appointment",
    icon: CalendarPlus,
    resource: "appointments",
    action: "write",
  },
  {
    href: "/appointments/booking-requests",
    label: "Booking Requests",
    icon: CalendarPlus,
    resource: "appointments",
    action: "read",
  },
  {
    href: "/clinical",
    label: "Clinical",
    icon: Stethoscope,
    resource: "clinical_chart",
    action: "read",
  },
  {
    href: "/clinical/treatment-plans",
    label: "Treatment Plans",
    icon: ClipboardCheck,
    resource: "clinical_schedule",
    action: "read",
  },
  {
    href: "/clinical/visit-board",
    label: "Visit board",
    icon: Timer,
    resource: "clinical_schedule",
    action: "read",
  },
  {
    href: "/clinical/emergency",
    label: "Emergency",
    icon: AlertCircle,
    resource: "clinical_chart",
    action: "read",
  },
  {
    href: "/clinical/chair-setup",
    label: "Chair setup",
    icon: Wrench,
    resource: "clinical_chart",
    action: "read",
  },
  {
    href: "/clinical/chair-prep",
    label: "Chair prep",
    icon: ClipboardList,
    resource: "clinical_chart",
    action: "read",
  },
  {
    href: "/billing",
    label: "Billing",
    icon: Receipt,
    resource: "billing",
    action: "read",
  },
  {
    href: "/billing/ready-to-invoice",
    label: "Ready to invoice",
    icon: Receipt,
    resource: "billing",
    action: "read",
  },
  {
    href: "/billing/claims",
    label: "Insurance claims",
    icon: Receipt,
    resource: "billing",
    action: "read",
  },
  {
    href: "/billing/end-of-day",
    label: "End of day",
    icon: BarChart3,
    resource: "billing",
    action: "read",
  },
  {
    href: "/billing/subscription",
    label: "Subscription",
    icon: CreditCard,
    resource: "admin",
    action: "read",
  },
  {
    href: "/inventory",
    label: "Inventory",
    icon: Package,
    resource: "inventory",
    action: "read",
  },
  {
    href: "/inventory/suppliers",
    label: "Suppliers",
    icon: ClipboardList,
    resource: "inventory",
    action: "read",
  },
  {
    href: "/inventory/chairs",
    label: "Chair stock",
    icon: ClipboardList,
    resource: "chair_inventory",
    action: "read",
  },
  {
    href: "/inventory/purchase-orders",
    label: "Purchase orders",
    icon: ClipboardList,
    resource: "inventory",
    action: "read",
  },
  {
    href: "/inventory/expiry",
    label: "Expiry alerts",
    icon: Timer,
    resource: "inventory",
    action: "read",
  },
  {
    href: "/inventory/count",
    label: "Stock count",
    icon: ClipboardList,
    resource: "inventory",
    action: "write",
  },
  {
    href: "/inventory/pos",
    label: "POS / Sales",
    icon: ShoppingCart,
    resource: "inventory",
    action: "write",
  },
  {
    href: "/hr",
    label: "Directory",
    icon: IdCard,
    resource: "hr",
    action: "read",
  },
  {
    href: "/hr/leave",
    label: "Leave approvals",
    icon: ClipboardCheck,
    resource: "hr",
    action: "read",
  },
  {
    href: "/hr/departments",
    label: "Departments",
    icon: Building2,
    resource: "hr",
    action: "write",
  },
  {
    href: "/hr/leave-types",
    label: "Leave types",
    icon: ClipboardList,
    resource: "hr",
    action: "write",
  },
  crmItem,
  reportsItem,
  aiItem,
  {
    href: "/admin/clinic-profile",
    label: "Clinic profile",
    icon: Building2,
    resource: "admin",
    action: "read",
  },
  {
    href: "/admin/procedure-catalog",
    label: "Procedure catalog",
    icon: Stethoscope,
    resource: "admin",
    action: "read",
  },
  {
    href: "/admin/clinical-templates",
    label: "Clinical templates",
    icon: Stethoscope,
    resource: "admin",
    action: "read",
  },
  {
    href: "/admin/portal-settings",
    label: "Patient Portal",
    icon: Globe,
    resource: "admin",
    action: "read",
  },
  {
    href: "/admin/customization",
    label: "Customization",
    icon: Settings2,
    resource: "admin",
    action: "read",
  },
  {
    href: "/admin",
    label: "Team & Settings",
    icon: Settings,
    resource: "admin",
    action: "read",
  },
  {
    href: "/admin/id-migration",
    label: "ID migration",
    icon: Fingerprint,
    resource: "admin",
    action: "read",
  },
];

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [dashboardItem, patientsItem, receptionItem, crmItem, reportsItem, aiItem],
  },
  {
    label: "Appointments",
    items: MAIN_NAV_ITEMS.filter((item) => item.href.startsWith("/appointments")),
  },
  {
    label: "Clinical",
    items: MAIN_NAV_ITEMS.filter((item) => item.href.startsWith("/clinical")),
  },
  {
    label: "Billing",
    items: MAIN_NAV_ITEMS.filter((item) => item.href.startsWith("/billing")),
  },
  {
    label: "Inventory",
    items: MAIN_NAV_ITEMS.filter((item) => item.href.startsWith("/inventory")),
  },
  {
    label: "HR",
    items: MAIN_NAV_ITEMS.filter((item) => item.href.startsWith("/hr")),
  },
  {
    label: "Admin",
    items: MAIN_NAV_ITEMS.filter((item) => item.href.startsWith("/admin")),
  },
];

function filterItemsForRole(role: UserRole, items: NavItem[]): NavItem[] {
  const allowed = items.filter((item) => can(role, item.action ?? "read", item.resource));
  if (normalizeDashboardRole(role) === "STORE") {
    return allowed.filter((item) => item.href !== "/reports");
  }
  return allowed;
}

export type NavFilterOptions = {
  spineEnabled?: boolean;
  clinicMode?: string | null;
};

function filterSpineItems(items: NavItem[], spineEnabled: boolean): NavItem[] {
  if (spineEnabled) return items;
  return items.filter((item) => item.href !== "/clinical/chair-prep");
}

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

export function getNavItemsForRole(
  role: UserRole,
  options: NavFilterOptions = {},
): NavItem[] {
  return getNavGroupsForRole(role, options).flatMap((group) => group.items);
}

export function getPrimaryNavForRole(role: UserRole): NavItem[] {
  const items = getNavItemsForRole(role);

  const priority: Partial<Record<Resource, number>> = {
    clinical_chart: 1,
    clinical_schedule: 1,
    appointments: 2,
    patients: 3,
    billing: 4,
    inventory: 5,
    reports: 6,
    admin: 7,
  };

  return [...items].sort((a, b) => {
    const aScore = priority[a.resource] ?? 99;
    const bScore = priority[b.resource] ?? 99;
    if (aScore !== bScore) return aScore - bScore;
    return a.label.localeCompare(b.label);
  });
}

export function isNavItemActive(pathname: string, item: NavItem): boolean {
  const matchPrefix = item.matchPrefix ?? item.href !== "/dashboard";
  return pathname === item.href || (matchPrefix && pathname.startsWith(item.href));
}

export function isNavGroupActive(pathname: string, group: NavGroup): boolean {
  return group.items.some((item) => isNavItemActive(pathname, item));
}
