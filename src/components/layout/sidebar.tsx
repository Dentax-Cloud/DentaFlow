"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { ChevronDown, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { SignOutButton } from "@/lib/auth/client";
import type { UserRole } from "@prisma/client";
import {
  getNavGroupsForRole,
  isNavGroupActive,
  isNavItemActive,
  type NavGroup,
} from "@/lib/rbac/navigation";
import { getRoleLabel } from "@/lib/rbac/permissions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";

export type SidebarUser = {
  firstName?: string | null;
  lastName?: string | null;
  email: string;
  avatarUrl?: string | null;
  staffRef?: string | null;
};

function displayName(user: SidebarUser) {
  const name = `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
  return name || user.email.split("@")[0];
}

function initials(user: SidebarUser) {
  const a = user.firstName?.charAt(0) ?? "";
  const b = user.lastName?.charAt(0) ?? "";
  if (a || b) return `${a}${b}`.toUpperCase();
  return user.email.charAt(0).toUpperCase();
}

function groupKey(group: NavGroup) {
  return group.label ?? "ungrouped";
}

export function Sidebar({
  userRole,
  user,
  tenantName,
  tenantLogoUrl,
  showHrSelfService = false,
  showHrNav = false,
  spineEnabled = true,
  clinicMode = null,
}: {
  userRole: UserRole;
  user?: SidebarUser;
  tenantName?: string;
  tenantLogoUrl?: string | null;
  showHrSelfService?: boolean;
  showHrNav?: boolean;
  spineEnabled?: boolean;
  clinicMode?: string | null;
}) {
  const pathname = usePathname();
  const navGroups = useMemo(() => {
    const groups = getNavGroupsForRole(userRole, { spineEnabled, clinicMode });
    if (showHrNav) return groups;
    return groups.filter((g) => g.label !== "HR");
  }, [userRole, showHrNav, spineEnabled, clinicMode]);

  const [manualOverrides, setManualOverrides] = useState<Record<string, boolean>>({});

  function isGroupExpanded(group: NavGroup) {
    const key = groupKey(group);
    if (key in manualOverrides) return manualOverrides[key];
    return isNavGroupActive(pathname, group);
  }

  function toggleGroup(group: NavGroup) {
    if (!group.label) return;
    const key = groupKey(group);
    const currentlyExpanded = isGroupExpanded(group);
    setManualOverrides((prev) => ({ ...prev, [key]: !currentlyExpanded }));
  }

  return (
    <aside className="flex h-full w-64 flex-col border-r bg-card">
      <div className="flex h-16 items-center gap-2 border-b px-6">
        {tenantLogoUrl ? (
          <Image
            src={tenantLogoUrl}
            alt={tenantName ?? "Clinic logo"}
            width={32}
            height={32}
            className="h-8 w-8 rounded-lg object-cover"
            unoptimized
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-dental text-sm font-bold text-white">
            {(tenantName ?? "D").charAt(0).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-bold tracking-tight">{tenantName ?? "DentaFlow"}</p>
          <p className="truncate text-[10px] text-muted-foreground">Powered by DentaFlow</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2 overflow-y-auto p-4">
        {showHrSelfService && (
          <div className="space-y-1">
            <Link
              href="/hr/me"
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/hr/me" || pathname.startsWith("/hr/me/")
                  ? "bg-dental/10 text-dental dark:text-sky-400"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              My HR
            </Link>
          </div>
        )}
        {navGroups.map((group) => {
          if (!group.label) {
            return (
              <div key="ungrouped" className="space-y-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavItemActive(pathname, item);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                        active
                          ? "bg-dental/10 text-dental dark:text-sky-400"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            );
          }

          const key = groupKey(group);
          const expanded = isGroupExpanded(group);
          const groupActive = isNavGroupActive(pathname, group);

          return (
            <div key={key} className="space-y-1">
              <button
                type="button"
                onClick={() => toggleGroup(group)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors",
                  groupActive
                    ? "text-dental dark:text-sky-400"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground",
                )}
              >
                <span>{group.label}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    expanded ? "rotate-0" : "-rotate-90",
                  )}
                />
              </button>
              {expanded && (
                <div className="ml-2 space-y-1 border-l border-border pl-2">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(pathname, item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                          active
                            ? "bg-dental/10 text-dental dark:text-sky-400"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="border-t p-4">
        {user && (
          <Link
            href="/account"
            className="mb-3 flex items-center gap-3 rounded-lg bg-muted/50 p-3 transition-colors hover:bg-muted"
          >
            <Avatar className="h-9 w-9">
              <AvatarImage src={user.avatarUrl ?? undefined} alt="" />
              <AvatarFallback className="text-xs">{initials(user)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{displayName(user)}</p>
              <p className="truncate text-xs text-muted-foreground">{getRoleLabel(userRole)}</p>
              {user.staffRef ? (
                <p className="truncate font-mono text-[10px] text-muted-foreground">
                  {user.staffRef}
                </p>
              ) : null}
            </div>
            <NotificationBell />
          </Link>
        )}
        <SignOutButton redirectUrl="/">
          <Button variant="outline" className="w-full justify-start gap-2" size="sm">
            <LogOut className="h-4 w-4" />
            Log out
          </Button>
        </SignOutButton>
      </div>
    </aside>
  );
}
