"use client";



import Link from "next/link";

import Image from "next/image";

import { usePathname } from "next/navigation";

import { Shield, LogOut } from "lucide-react";

import { cn } from "@/lib/utils";

import { SignOutButton } from "@/lib/auth/stubs/client";

import type { UserRole } from "@prisma/client";

import { getNavItemsForRole, type NavItem } from "@/lib/rbac/navigation";

import { getRoleLabel } from "@/lib/rbac/permissions";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

import { Button } from "@/components/ui/button";



const superAdminItems: NavItem[] = [

  {

    href: "/super-admin",

    label: "Super Admin",

    icon: Shield,

    resource: "admin",

    action: "write",

  },

  {

    href: "/admin/tenant-approvals",

    label: "Tenant Approvals",

    icon: Shield,

    resource: "admin",

    action: "write",

  },

];



export type SidebarUser = {

  firstName?: string | null;

  lastName?: string | null;

  email: string;

  avatarUrl?: string | null;

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



export function Sidebar({

  userRole,

  user,

  isSuperAdmin = false,

  tenantName,

  tenantLogoUrl,

}: {

  userRole: UserRole;

  user?: SidebarUser;

  isSuperAdmin?: boolean;

  tenantName?: string;

  tenantLogoUrl?: string | null;

}) {

  const pathname = usePathname();

  const navItems = getNavItemsForRole(userRole);

  const items = isSuperAdmin ? [...navItems, ...superAdminItems] : navItems;



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



      <nav className="flex-1 space-y-1 overflow-y-auto p-4">

        {items.map((item) => {

          const Icon = item.icon;

          const matchPrefix = item.matchPrefix ?? item.href !== "/dashboard";

          const active =

            pathname === item.href ||

            (matchPrefix && pathname.startsWith(item.href));

          return (

            <Link

              key={item.href}

              href={item.href}

              className={cn(

                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",

                active

                  ? "bg-dental/10 text-dental dark:text-sky-400"

                  : "text-muted-foreground hover:bg-accent hover:text-foreground",

                item.href === "/super-admin" && "text-violet-600 dark:text-violet-400",

              )}

            >

              <Icon className="h-4 w-4" />

              {item.label}

            </Link>

          );

        })}

      </nav>



      <div className="border-t p-4">

        {user && (

          <div className="mb-3 flex items-center gap-3 rounded-lg bg-muted/50 p-3">

            <Avatar className="h-9 w-9">

              <AvatarImage src={user.avatarUrl ?? undefined} alt="" />

              <AvatarFallback className="text-xs">{initials(user)}</AvatarFallback>

            </Avatar>

            <div className="min-w-0 flex-1">

              <p className="truncate text-sm font-medium">{displayName(user)}</p>

              <p className="truncate text-xs text-muted-foreground">{getRoleLabel(userRole)}</p>

            </div>

          </div>

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

