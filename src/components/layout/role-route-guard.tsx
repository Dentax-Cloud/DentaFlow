"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { canAccessPath, getRoleHomePath } from "@/lib/rbac/routes";

export function RoleRouteGuard({
  role,
  isSuperAdmin = false,
}: {
  role: UserRole;
  isSuperAdmin?: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isSuperAdmin) return;
    if (!canAccessPath(role, pathname)) {
      router.replace(getRoleHomePath(role));
    }
  }, [role, pathname, router, isSuperAdmin]);

  return null;
}
