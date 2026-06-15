import Pusher from "pusher";

function firstNonEmpty(...keys) {
  for (const key of keys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

const appId = firstNonEmpty("PUSHER_APP_ID");
const secret = firstNonEmpty("PUSHER_SECRET");
const key = firstNonEmpty("PUSHER_KEY", "NEXT_PUBLIC_PUSHER_KEY");
const cluster = firstNonEmpty("PUSHER_CLUSTER", "NEXT_PUBLIC_PUSHER_CLUSTER");

if (!appId || !secret || !key || !cluster) {
  console.error("Missing Pusher env vars");
  process.exit(1);
}

const pusher = new Pusher({
  appId,
  key,
  secret,
  cluster,
  useTLS: true,
});

const result = await pusher.trigger("my-channel", "my-event", {
  message: "DentaFlow Pusher Channels test",
  at: new Date().toISOString(),
});

console.log(JSON.stringify({ ok: true, channel: "my-channel", event: "my-event", result }));
