import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { recordWhatsAppMessage, updateWhatsAppMessageStatus } from "@/lib/whatsapp/client";

/**
 * WhatsApp Webhook Handler
 * Handles incoming messages and status updates from Meta Cloud API
 * 
 * Webhook verification: GET request with hub.verify_token
 * Message handling: POST request with payload
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Verify webhook setup
  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }

  return NextResponse.json({ error: "Invalid verification" }, { status: 403 });
}

export async function POST(req: NextRequest) {
  try {
    const signature = (await headers()).get("x-hub-signature-256");
    const body = await req.text();

    // Verify webhook signature (optional but recommended)
    if (signature && process.env.WHATSAPP_APP_SECRET) {
      const expectedSignature = "sha256=" + 
        crypto.createHmac("sha256", process.env.WHATSAPP_APP_SECRET)
          .update(body)
          .digest("hex");
      
      if (signature !== expectedSignature) {
        console.error("[WhatsApp Webhook] Invalid signature");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
    }

    const data = JSON.parse(body);

    // Handle message status updates
    if (data.entry?.[0]?.changes?.[0]?.value?.statuses) {
      for (const status of data.entry[0].changes[0].value.statuses) {
        const externalMessageId = status.id;
        const statusValue = status.status; // sent, delivered, read, failed

        await updateWhatsAppMessageStatus(
          externalMessageId,
          statusValue.toUpperCase() as "SENT" | "DELIVERED" | "READ" | "FAILED",
        );
      }
    }

    // Handle incoming messages
    if (data.entry?.[0]?.changes?.[0]?.value?.messages) {
      for (const message of data.entry[0].changes[0].value.messages) {
        const from = message.from; // Patient phone number
        const messageContent = message.text?.body;
        const externalMessageId = message.id;

        if (!messageContent) continue;

        // Find patient by phone number
        const patient = await db.patient.findFirst({
          where: {
            phone: {
              contains: from.replace("+", ""), // Match with or without +
            },
          },
          select: {
            id: true,
            tenantId: true,
          },
        });

        if (!patient) {
          console.log(`[WhatsApp Webhook] No patient found for phone: ${from}`);
          continue;
        }

        // Record incoming message
        await recordWhatsAppMessage({
          tenantId: patient.tenantId,
          patientId: patient.id,
          direction: "IN",
          content: messageContent,
          status: "SENT",
          externalMessageId,
        });

        console.log(`[WhatsApp Webhook] Recorded message from patient ${patient.id}`);
      }
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("[WhatsApp Webhook] Error:", error);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
