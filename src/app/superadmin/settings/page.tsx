export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { seedPlatformDefaults } from "@/lib/settings/platform-settings";
import PlatformSettingsClient from "./settings-client";

export default async function PlatformSettingsPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.isSuperAdmin) redirect("/login");

  await seedPlatformDefaults();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Platform Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Configure API keys and platform behaviour. Keys are encrypted with AES-256-GCM before
          storage. Changes take effect immediately — no restart needed.
        </p>
      </div>

      <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          🔒 <strong>Security:</strong> Sensitive keys are encrypted at rest and never returned to
          the browser. The encryption key lives separately in{" "}
          <code className="rounded bg-blue-100 px-1 font-mono text-xs">
            SETTINGS_ENCRYPTION_KEY
          </code>{" "}
          in your server environment.
        </p>
      </div>

      <PlatformSettingsClient />
    </div>
  );
}
