export const runtime = "nodejs";

import { redirect, notFound } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContextBySlug } from "@/lib/tenant/context";

export default async function TenantLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  try {
    const ctx = await requireTenantContextBySlug(tenantSlug);
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b px-6 py-4">
          <h1 className="text-lg font-semibold">{ctx.tenant.name}</h1>
          <p className="text-sm text-muted-foreground">/{tenantSlug}</p>
        </header>
        {children}
      </div>
    );
  } catch {
    notFound();
  }
}
