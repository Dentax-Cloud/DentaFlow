import type { UserRole } from "@prisma/client";
import { normalizeDashboardRole } from "@/lib/rbac/permissions";
import {
  AdminDashboardHome,
  DoctorDashboardHome,
  ReceptionistDashboardHome,
  FinanceDashboardHome,
  StoreDashboardHome,
} from "@/components/dashboard/role-dashboards/role-dashboard-homes";

type KPIs = {
  todayAppointments: number;
  completedToday: number;
  pendingInvoices: number;
  revenueThisMonth: number;
  chairUtilization: number;
  patientCount: number;
  inChairNow: number;
  totalChairs: number;
};

export function RoleDashboardHome({
  role,
  kpis,
  tenantName,
}: {
  role: UserRole;
  kpis: KPIs;
  tenantName: string;
}) {
  switch (normalizeDashboardRole(role)) {
    case "DOCTOR":
      return <DoctorDashboardHome kpis={kpis} />;
    case "RECEPTIONIST":
      return <ReceptionistDashboardHome kpis={kpis} />;
    case "FINANCE":
      return <FinanceDashboardHome kpis={kpis} />;
    case "STORE":
      return <StoreDashboardHome kpis={kpis} />;
    case "ADMIN":
    default:
      return <AdminDashboardHome kpis={kpis} tenantName={tenantName} />;
  }
}

/** Role-specific dashboard layout metadata (landing paths & titles). */
export function getRoleDashboardMeta(role: UserRole) {
  switch (normalizeDashboardRole(role)) {
    case "DOCTOR":
      return { title: "Doctor dashboard", focus: "clinical" as const };
    case "RECEPTIONIST":
      return { title: "Reception desk", focus: "appointments" as const };
    case "FINANCE":
      return { title: "Finance dashboard", focus: "billing" as const };
    case "STORE":
      return { title: "Store dashboard", focus: "inventory" as const };
    default:
      return { title: "Admin dashboard", focus: "overview" as const };
  }
}
