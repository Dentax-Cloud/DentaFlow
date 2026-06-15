export const runtime = "nodejs";

import { auth } from "@clerk/nextjs/server";
import { getTenantContext } from "@/lib/tenant/context";
import { getPusherServer } from "@/lib/pusher";
import { isPusherServerConfigured, tenantChannel } from "@/lib/pusher-env";

export async function POST(req: Request) {
  if (!isPusherServerConfigured()) {
    return Response.json(
      { error: "Real-time messaging is not configured on this server." },
      { status: 503 },
    );
  }

  const { userId, orgId } = await auth();
  if (!userId || !orgId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const ctx = await getTenantContext();
  if (!ctx) {
    return new Response("Unauthorized", { status: 401 });
  }

  const pusher = getPusherServer();
  if (!pusher) {
    return Response.json({ error: "Pusher unavailable." }, { status: 503 });
  }

  let socketId: string | null = null;
  let channelName: string | null = null;

  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await req.json()) as {
      socket_id?: string;
      channel_name?: string;
    };
    socketId = body.socket_id ?? null;
    channelName = body.channel_name ?? null;
  } else {
    const form = await req.formData();
    socketId = form.get("socket_id")?.toString() ?? null;
    channelName = form.get("channel_name")?.toString() ?? null;
  }

  if (!socketId || !channelName) {
    return new Response("Bad Request", { status: 400 });
  }

  const allowed = tenantChannel(ctx.tenant.id);
  if (channelName !== allowed) {
    return new Response("Forbidden", { status: 403 });
  }

  const authResponse = pusher.authorizeChannel(socketId, channelName, {
    user_id: ctx.user.id,
    user_info: {
      tenantId: ctx.tenant.id,
      clerkUserId: ctx.clerkUserId,
    },
  });

  return Response.json(authResponse);
}
