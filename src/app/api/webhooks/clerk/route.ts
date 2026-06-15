export const runtime = "nodejs";

import { Webhook } from "svix";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { provisionTenantFromWebhook } from "@/lib/tenant/service";

type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    organization_id?: string;
    public_user_data?: { user_id?: string };
    email_addresses?: { email_address: string }[];
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
};

export async function POST(req: Request) {
  const payload = await req.text();
  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature || !process.env.CLERK_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET);
  let evt: ClerkWebhookEvent;

  try {
    evt = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (evt.type === "organizationMembership.created") {
    const orgId = evt.data.organization_id;
    const clerkUserId = evt.data.public_user_data?.user_id ?? evt.data.id;
    if (orgId) {
      await provisionTenantFromWebhook({
        clerkOrgId: orgId,
        clerkUserId,
      });
    }
  }

  if (evt.type === "organization.created") {
    const orgId = evt.data.id;
    if (orgId) {
      await provisionTenantFromWebhook({ clerkOrgId: orgId });
    }
  }

  return NextResponse.json({ received: true });
}
