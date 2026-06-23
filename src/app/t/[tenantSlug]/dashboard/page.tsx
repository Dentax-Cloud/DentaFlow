import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function TenantSlugDashboard({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await getServerAuthSession();

  if (!session?.user?.id) redirect("/login");

  const tenant = await db.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) redirect("/dashboard");

  if (session.user.activeTenantId === tenant.id) {
    redirect("/dashboard");
  }

  const membership = await db.tenant_memberships.findFirst({
    where: { userId: session.user.id, tenantId: tenant.id, isActive: true },
  });

  if (membership) {
    await db.auth_users.update({
      where: { id: session.user.id },
      data: { activeTenantId: tenant.id },
    });
  }

  redirect("/dashboard");
}
