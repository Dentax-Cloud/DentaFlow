/**
 * Pusher Channels env (not Beams). Client requires NEXT_PUBLIC_* in Next.js;
 * PUSHER_KEY / PUSHER_CLUSTER are optional server-side aliases.
 */
export type PusherEnv = {
  appId: string;
  secret: string;
  key: string;
  cluster: string;
};

function firstNonEmpty(...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

/** Client-side (browser) — requires NEXT_PUBLIC_* vars. */
export function isPusherClientConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_PUSHER_KEY?.trim() &&
      process.env.NEXT_PUBLIC_PUSHER_CLUSTER?.trim(),
  );
}

/** Server-side — all four Channels credentials. */
export function isPusherServerConfigured(): boolean {
  return Boolean(
    firstNonEmpty("PUSHER_APP_ID") &&
      firstNonEmpty("PUSHER_SECRET") &&
      firstNonEmpty("PUSHER_KEY", "NEXT_PUBLIC_PUSHER_KEY") &&
      firstNonEmpty("PUSHER_CLUSTER", "NEXT_PUBLIC_PUSHER_CLUSTER"),
  );
}

export function getPusherEnv(): PusherEnv {
  const appId = firstNonEmpty("PUSHER_APP_ID");
  const secret = firstNonEmpty("PUSHER_SECRET");
  const key = firstNonEmpty("PUSHER_KEY", "NEXT_PUBLIC_PUSHER_KEY");
  const cluster = firstNonEmpty("PUSHER_CLUSTER", "NEXT_PUBLIC_PUSHER_CLUSTER");

  const missing: string[] = [];
  if (!appId) missing.push("PUSHER_APP_ID");
  if (!secret) missing.push("PUSHER_SECRET");
  if (!key) missing.push("PUSHER_KEY or NEXT_PUBLIC_PUSHER_KEY");
  if (!cluster) missing.push("PUSHER_CLUSTER or NEXT_PUBLIC_PUSHER_CLUSTER");

  if (missing.length > 0) {
    throw new Error(`Missing Pusher Channels env: ${missing.join(", ")}`);
  }

  return { appId: appId!, secret: secret!, key: key!, cluster: cluster! };
}

export function tenantChannel(tenantId: string) {
  return `private-tenant-${tenantId}`;
}
