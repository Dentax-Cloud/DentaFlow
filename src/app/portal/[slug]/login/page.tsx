export const runtime = "nodejs";

import { getPortalTenant } from "@/lib/portal/portal-context";
import { notFound } from "next/navigation";
import PortalLoginClient from "./login-client";

export default async function PortalLoginPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const tenant = await getPortalTenant(slug);
  if (!tenant || !tenant.portalEnabled) notFound();

  return (
    <div className="mx-auto max-w-sm py-8">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">Sign in</h1>
        <p className="mt-1 text-sm text-muted-foreground">{tenant.name} Patient Portal</p>
      </div>
      <PortalLoginClient slug={slug} tenantName={tenant.name} />
    </div>
  );
}
