import { auth } from "@clerk/nextjs/server";
import { isSuperAdmin } from "@/lib/tenant/config";
import { getPusherServer } from "@/lib/pusher";

const TEST_CHANNEL = "my-channel";
const TEST_EVENT = "my-event";

function canRunPusherTest(userId: string | null): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return userId !== null && isSuperAdmin(userId);
}

async function triggerTestEvent() {
  const pusher = getPusherServer();
  if (!pusher) {
    throw new Error("Pusher is not configured. Set PUSHER_APP_ID, PUSHER_SECRET, and key/cluster env vars.");
  }
  await pusher.trigger(TEST_CHANNEL, TEST_EVENT, {
    message: "DentaFlow Pusher Channels test",
    at: new Date().toISOString(),
  });
}

export async function GET() {
  const { userId } = await auth();
  if (!canRunPusherTest(userId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    await triggerTestEvent();
    return Response.json({
      ok: true,
      channel: TEST_CHANNEL,
      event: TEST_EVENT,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pusher trigger failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
