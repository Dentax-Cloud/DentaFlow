import { TenantRole } from "@prisma/client";
import { db } from "@/lib/db";
import { getServerAuthSession, resolveIsSuperAdmin } from "@/lib/auth";

export async function getMembershipForTenant(userId: string, tenantId: string) {
  return db.tenantMembership.findUnique({
    where: { userId_tenantId: { userId, tenantId } },
  });
}

export async function requireTenantMembership(tenantId: string) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) throw new Error("UNAUTHORIZED");

  const membership = await getMembershipForTenant(session.user.id, tenantId);
  if (!membership && !session.user.isSuperAdmin) {
    throw new Error("FORBIDDEN");
  }

  return {
    userId: session.user.id,
    membership,
    isSuperAdmin: session.user.isSuperAdmin,
  };
}

export function hasTenantRole(
  role: TenantRole | null | undefined,
  allowed: TenantRole[],
): boolean {
  if (!role) return false;
  return allowed.includes(role);
}

export async function canAccessTenantSlug(slug: string) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) return false;
  if (session.user.isSuperAdmin) return true;

  const tenant = await db.tenant.findUnique({ where: { slug } });
  if (!tenant) return false;

  const membership = await getMembershipForTenant(session.user.id, tenant.id);
  return Boolean(membership);
}

export async function isUserSuperAdmin(userId: string): Promise<boolean> {
  if (parseSuperAdminEnv().includes(userId)) return true;
  const superMembership = await db.tenantMembership.findFirst({
    where: { userId, role: TenantRole.SUPERADMIN },
  });
  return Boolean(superMembership);
}

function parseSuperAdminEnv(): string[] {
  return (process.env.SUPER_ADMIN_AUTH_USER_IDS ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

export { resolveIsSuperAdmin };
