import Pusher from "pusher";
import { getPusherEnv, isPusherServerConfigured, tenantChannel } from "@/lib/pusher-env";

export { tenantChannel };

let pusherServer: Pusher | null = null;
let warnedMissing = false;

function warnMissingServer() {
  if (warnedMissing) return;
  warnedMissing = true;
  console.warn(
    "[DentaFlow] Pusher server disabled: set PUSHER_APP_ID, PUSHER_SECRET, and key/cluster env vars to enable broadcasts.",
  );
}

/**
 * Returns a singleton server Pusher instance, or null when not configured.
 */
export function getPusherServer(): Pusher | null {
  if (!isPusherServerConfigured()) {
    warnMissingServer();
    return null;
  }

  if (!pusherServer) {
    const { appId, secret, key, cluster } = getPusherEnv();
    pusherServer = new Pusher({
      appId,
      key,
      secret,
      cluster,
      useTLS: true,
    });
  }
  return pusherServer;
}

export function isPusherBroadcastAvailable(): boolean {
  return isPusherServerConfigured();
}

export async function broadcastAppointmentUpdate(
  tenantId: string,
  appointment: Record<string, unknown>,
): Promise<void> {
  const pusher = getPusherServer();
  if (!pusher) return;

  try {
    await pusher.trigger(tenantChannel(tenantId), "appointment:updated", appointment);
  } catch (error) {
    console.warn("[DentaFlow] Failed to broadcast appointment update:", error);
  }
}
