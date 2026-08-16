"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sidebar, type SidebarUser } from "./sidebar";
import { RoleRouteGuard } from "./role-route-guard";
import { NotificationBell } from "./notification-bell";
import type { UserRole } from "@prisma/client";

export function DashboardShell({
  children,
  userRole,
  user,
  tenantName,
  tenantLogoUrl,
  trialDaysLeft = null,
  showHrSelfService = false,
  showHrNav = false,
  spineEnabled = true,
}: {
  children: React.ReactNode;
  userRole: UserRole;
  user?: SidebarUser;
  tenantName?: string;
  tenantLogoUrl?: string | null;
  trialDaysLeft?: number | null;
  showHrSelfService?: boolean;
  showHrNav?: boolean;
  spineEnabled?: boolean;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background md:flex-row">
      <RoleRouteGuard role={userRole} />
      <div className="flex items-center border-b px-4 py-3 md:hidden">
        <button
          type="button"
          aria-label="Toggle menu"
          onClick={() => setMobileOpen((o) => !o)}
          className="rounded-md p-2 hover:bg-accent"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="ml-3 font-semibold">{tenantName ?? "DentaFlow"}</span>
        <div className="ml-auto">
          <NotificationBell />
        </div>
      </div>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform transition-transform md:relative md:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Sidebar
          userRole={userRole}
          user={user}
          tenantName={tenantName}
          tenantLogoUrl={tenantLogoUrl}
          showHrSelfService={showHrSelfService}
          showHrNav={showHrNav}
          spineEnabled={spineEnabled}
        />
      </div>

      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="flex-1 overflow-y-auto">
        {trialDaysLeft !== null && trialDaysLeft <= 7 && (
          <div
            className={`px-4 py-2 text-center text-sm font-medium ${
              trialDaysLeft <= 1
                ? "bg-red-500 text-white"
                : trialDaysLeft <= 3
                  ? "bg-orange-500 text-white"
                  : "bg-yellow-500 text-black"
            }`}
          >
            {trialDaysLeft === 0
              ? "Your trial expires today! "
              : `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left in your trial. `}
            <Link href="/billing/subscription" className="font-bold underline">
              Upgrade now
            </Link>
          </div>
        )}
        <div className="container mx-auto max-w-7xl p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}