import { Sidebar, type SidebarUser } from "./sidebar";

import { RoleRouteGuard } from "./role-route-guard";

import type { UserRole } from "@prisma/client";



export function DashboardShell({

  children,

  userRole,

  user,

  isSuperAdmin = false,

  tenantName,

  tenantLogoUrl,

}: {

  children: React.ReactNode;

  userRole: UserRole;

  user?: SidebarUser;

  isSuperAdmin?: boolean;

  tenantName?: string;

  tenantLogoUrl?: string | null;

}) {

  return (

    <div className="flex h-screen overflow-hidden bg-background">

      <RoleRouteGuard role={userRole} isSuperAdmin={isSuperAdmin} />

      <Sidebar

        userRole={userRole}

        user={user}

        isSuperAdmin={isSuperAdmin}

        tenantName={tenantName}

        tenantLogoUrl={tenantLogoUrl}

      />

      <main className="flex-1 overflow-y-auto">

        <div className="container mx-auto max-w-7xl p-6">{children}</div>

      </main>

    </div>

  );

}

