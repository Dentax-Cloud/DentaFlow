export const runtime = "nodejs";

import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getPortalSettings } from "./actions";
import PortalSettingsClient from "./portal-settings-client";

export default async function PortalSettingsPage() {
  await requireRouteAccess("admin", "read");
  const settings = await getPortalSettings();
  if (!settings) return null;

  const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? "";
  const portalUrl = `${baseUrl}/portal/${settings.slug}`;

  return <PortalSettingsClient settings={settings} portalUrl={portalUrl} />;
}
