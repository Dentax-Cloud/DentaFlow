"use client";

import PusherClient from "pusher-js";
import { isPusherClientConfigured, tenantChannel } from "@/lib/pusher-env";

export { tenantChannel };

let client: PusherClient | null = null;
let warnedMissing = false;

function warnMissingClient() {
  if (warnedMissing || typeof window === "undefined") return;
  warnedMissing = true;
  console.warn(
    "[DentaFlow] Real-time updates disabled: set NEXT_PUBLIC_PUSHER_KEY and NEXT_PUBLIC_PUSHER_CLUSTER in .env to enable Pusher.",
  );
}

/**
 * Returns a singleton Pusher client, or null when credentials are not configured.
 * Real-time features are optional during local development.
 */
export function getPusherClient(): PusherClient | null {
  if (!isPusherClientConfigured()) {
    warnMissingClient();
    return null;
  }

  if (!client) {
    const key = process.env.NEXT_PUBLIC_PUSHER_KEY!.trim();
    const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER!.trim();
    client = new PusherClient(key, {
      cluster,
      authEndpoint: "/api/pusher/auth",
    });
  }
  return client;
}

export function isRealtimeAvailable(): boolean {
  return isPusherClientConfigured();
}
