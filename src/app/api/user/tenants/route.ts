export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const session = await getServerAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const switchTo = req.nextUrl.searchParams.get("switchTo");

  if (switchTo) {
    const isSuperAdmin = session.user.isSuperAdmin === true;

    if (!isSuperAdmin) {
      const membership = await db.tenant_memberships.findFirst({
        where: { userId: session.user.id, tenantId: switchTo, isActive: true },
      });
      if (!membership) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    } else {
      const tenant = await db.tenant.findFirst({
        where: { id: switchTo, deletedAt: null },
      });
      if (!tenant) {
        return NextResponse.json({ error: "Tenant not found" }, { status: 404 });
      }
    }

    await db.auth_users.update({
      where: { id: session.user.id },
      data: { activeTenantId: switchTo },
    });

    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  const memberships = await db.tenant_memberships.findMany({
    where: { userId: session.user.id, isActive: true },
    include: { Tenant: true },
  });

  return NextResponse.json(
    memberships.map((m) => ({
      id: m.Tenant.id,
      name: m.Tenant.name,
      slug: m.Tenant.slug,
      role: m.role,
    })),
  );
}
