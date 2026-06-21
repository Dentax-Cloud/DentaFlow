export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function GET() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const memberships = await db.tenantMembership.findMany({
    where: { userId: session.user.id },
    include: {
      tenant: {
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
    .filter((m) => m.tenant.deletedAt === null)
    .map((m) => ({
      id: m.tenant.id,
      name: m.tenant.name,
      slug: m.tenant.slug,
      status: m.tenant.status,
      plan: m.tenant.subscriptionPlan,
      logoUrl: m.tenant.logoUrl,
      role: m.role,
      membershipId: m.id,
      isActive: m.tenantId === session.user.activeTenantId,
    }));

  return NextResponse.json({ tenants });
}
