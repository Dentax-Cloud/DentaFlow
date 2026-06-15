import type { UserRole } from "@prisma/client";
import { normalizeDashboardRole } from "@/lib/rbac/permissions";
import { DashboardShell } from "@/components/layout/dashboard-shell";

type RoleDashboardLayoutProps = {
  role: UserRole;
  tenantName?: string;
  tenantLogoUrl?: string | null;
  isSuperAdmin?: boolean;
  children: React.ReactNode;
};

function createRoleLayout() {
  return function RoleLayout({
    role,
    tenantName,
    tenantLogoUrl,
    isSuperAdmin,
    children,
  }: RoleDashboardLayoutProps) {
    return (
      <DashboardShell
        userRole={role}
        isSuperAdmin={isSuperAdmin}
        tenantName={tenantName}
        tenantLogoUrl={tenantLogoUrl}
      >
        {children}
      </DashboardShell>
    );
  };
}

export const AdminDashboardLayout = createRoleLayout();
export const DoctorDashboardLayout = createRoleLayout();
export const ReceptionistDashboardLayout = createRoleLayout();
export const FinanceDashboardLayout = createRoleLayout();
export const StoreDashboardLayout = createRoleLayout();

export function resolveRoleDashboardLayout(role: UserRole) {
  switch (normalizeDashboardRole(role)) {
    case "DOCTOR":
      return DoctorDashboardLayout;
    case "RECEPTIONIST":
      return ReceptionistDashboardLayout;
    case "FINANCE":
      return FinanceDashboardLayout;
    case "STORE":
      return StoreDashboardLayout;
    default:
      return AdminDashboardLayout;
  }
}
