import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Stethoscope,
  Activity,
  Armchair,
  ScanLine,
  Camera,
  AlertCircle,
  Receipt,
  Package,
  Megaphone,
  BarChart3,
  Settings,
  Sparkles,
  CreditCard,
  Building2,
} from "lucide-react";
import type { UserRole } from "@prisma/client";
import { can, type Action, type Resource } from "./permissions";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
  resource: Resource;
  action?: Action;
  /** Match nested routes (default true except dashboard). */
  matchPrefix?: boolean;
};

export const MAIN_NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    resource: "reports",
    action: "read",
    matchPrefix: false,
  },
  {
    href: "/patients",
    label: "Patients",
    icon: Users,
    resource: "patients",
    action: "read",
  },
  {
    href: "/appointments",
    label: "Appointments",
    icon: Calendar,
    resource: "appointments",
    action: "read",
  },
  {
    href: "/clinical",
    label: "Clinical",
    icon: Stethoscope,
    resource: "clinical",
    action: "read",
  },
  {
    href: "/clinical/perio",
    label: "Periodontal",
    icon: Activity,
    resource: "clinical",
    action: "read",
  },
  {
    href: "/clinical/chairside",
    label: "Chairside",
    icon: Armchair,
    resource: "clinical",
    action: "read",
  },
  {
    href: "/clinical/radiographs",
    label: "Radiographs",
    icon: ScanLine,
    resource: "clinical",
    action: "read",
  },
  {
    href: "/clinical/photos",
    label: "Clinical Photos",
    icon: Camera,
    resource: "clinical",
    action: "read",
  },
  {
    href: "/clinical/emergency",
    label: "Emergency",
    icon: AlertCircle,
    resource: "clinical",
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
    href: "/crm",
    label: "CRM",
    icon: Megaphone,
    resource: "crm",
    action: "read",
  },
  {
    href: "/reports",
    label: "Reports",
    icon: BarChart3,
    resource: "reports",
    action: "read",
  },
  {
    href: "/ai",
    label: "AI Assistant",
    icon: Sparkles,
    resource: "ai",
    action: "use",
  },
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
    href: "/admin",
    label: "Admin",
    icon: Settings,
    resource: "admin",
    action: "read",
  },
];

export function getNavItemsForRole(role: UserRole): NavItem[] {
  return MAIN_NAV_ITEMS.filter((item) => can(role, item.action ?? "read", item.resource));
}

export function getPrimaryNavForRole(role: UserRole): NavItem[] {
  const dashboardRole = role;
  const items = getNavItemsForRole(dashboardRole);

  const priority: Partial<Record<Resource, number>> = {
    clinical: 1,
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
