import type { NavItem } from "./navigation";
import {
  LayoutDashboard,
  Users,
  Stethoscope,
  Wrench,
  Receipt,
  Package,
  Settings,
  Calendar,
  CalendarPlus,
} from "lucide-react";

/** Simplified navigation for solo-doctor clinics. */
export const SOLO_NAV_ITEMS: NavItem[] = [
  {
    href: "/dashboard",
    label: "Today",
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
    href: "/appointments/book",
    label: "Book Appointment",
    icon: CalendarPlus,
    resource: "appointments",
    action: "write",
  },
  {
    href: "/clinical",
    label: "Clinical",
    icon: Stethoscope,
    resource: "clinical_chart",
    action: "read",
  },
  {
    href: "/clinical/chair-setup",
    label: "Chair & Tray",
    icon: Wrench,
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
    href: "/inventory",
    label: "Inventory",
    icon: Package,
    resource: "inventory",
    action: "read",
  },
  {
    href: "/admin",
    label: "Practice",
    icon: Settings,
    resource: "admin",
    action: "read",
  },
];
