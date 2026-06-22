export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db.tenant_memberships.findMany({
    where: { userId: session.user.id },
    include: {
      Tenant: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          subscriptionPlan: true,
          logoUrl: true,
          deletedAt: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const tenants = memberships
    .filter((m) => m.Tenant.deletedAt === null)
    .map((m) => ({
      id: m.Tenant.id,
      name: m.Tenant.name,
      slug: m.Tenant.slug,
      status: m.Tenant.status,
      plan: m.Tenant.subscriptionPlan,
      logoUrl: m.Tenant.logoUrl,
      role: m.role,
      membershipId: m.id,
      isActive: m.tenantId === session.user.activeTenantId,
    }));

  return NextResponse.json({ tenants });
}
