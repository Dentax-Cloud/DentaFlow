export const runtime = "nodejs";

import { getPortalTenant } from "@/lib/portal/portal-context";
import { notFound } from "next/navigation";

export default async function PortalLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getPortalTenant(slug);

  if (!tenant) notFound();

  const logoUrl = tenant.portalLogoUrl ?? tenant.logoUrl;

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          {logoUrl ? (
            <img src={logoUrl} alt={tenant.name} className="h-8 object-contain" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-sm font-bold text-white">
              {tenant.name.substring(0, 2).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-semibold">{tenant.name}</p>
            <p className="text-xs text-muted-foreground">Patient Portal</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 pb-24">{children}</main>

      <footer className="mt-12 border-t py-6 text-center">
        <p className="text-xs text-muted-foreground">
          {tenant.name} Patient Portal · Powered by DentaFlow
        </p>
        {tenant.phone && (
          <p className="mt-1 text-xs text-muted-foreground">📞 {tenant.phone}</p>
        )}
      </footer>
    </div>
  );
}
