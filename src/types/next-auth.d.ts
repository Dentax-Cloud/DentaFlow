import type { TenantRole } from "@prisma/client";
import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      image?: string | null;
      activeTenantId: string | null;
      role: TenantRole | null;
      isSuperAdmin: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    activeTenantId: string | null;
    role: TenantRole | null;
    isSuperAdmin: boolean;
  }
}
