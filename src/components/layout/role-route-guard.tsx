"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { UserRole } from "@prisma/client";
import { canAccessPath, getRoleHomePath } from "@/lib/rbac/routes";

export function RoleRouteGuard({ role }: { role: UserRole }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!canAccessPath(role, pathname)) {
      router.replace(getRoleHomePath(role));
    }
  }, [role, pathname, router]);

  return null;
}
