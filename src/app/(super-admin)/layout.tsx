import { SuperAdminGuard } from "@/components/super-admin/super-admin-guard";
import { SuperAdminShell } from "@/components/layout/super-admin-shell";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <SuperAdminGuard>
      <SuperAdminShell>{children}</SuperAdminShell>
    </SuperAdminGuard>
  );
}
