import { encrypt, decrypt } from "@/lib/settings/encrypt";
import { db } from "@/lib/db";

export const WHATSAPP_DIRECTION = {
  IN: "IN",
  OUT: "OUT",
} as const;

export const WHATSAPP_STATUS = {
  SENT: "SENT",
  DELIVERED: "DELIVERED",
  READ: "READ",
  FAILED: "FAILED",
} as const;

export type WhatsAppDirection = typeof WHATSAPP_DIRECTION[keyof typeof WHATSAPP_DIRECTION];
export type WhatsAppStatus = typeof WHATSAPP_STATUS[keyof typeof WHATSAPP_STATUS];

export interface SendWhatsAppParams {
  tenantId: string;
  patientId: string;
  appointmentId?: string;
  templateName?: string;
  content: string;
}

export interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
  businessName?: string;
  isEnabled: boolean;
}

/**
 * Get WhatsApp configuration for a tenant with decrypted access token
 */
export async function getWhatsAppConfig(tenantId: string): Promise<WhatsAppConfig | null> {
  const config = await db.tenantWhatsAppConfig.findUnique({
    where: { tenantId },
  });

  if (!config || !config.isEnabled) {
    return null;
  }

  try {
    const decryptedToken = decrypt(config.accessToken);
    return {
      phoneNumberId: config.phoneNumberId,
      accessToken: decryptedToken,
      businessName: config.businessName ?? undefined,
      isEnabled: config.isEnabled,
    };
  } catch (error) {
    console.error(`[WhatsApp] Failed to decrypt access token for tenant ${tenantId}:`, error);
    return null;
  }
}

/**
 * Save or update WhatsApp configuration for a tenant with encrypted access token
 */
export async function saveWhatsAppConfig(params: {
  tenantId: string;
  phoneNumberId: string;
  accessToken: string;
  businessName?: string;
  isEnabled?: boolean;
}): Promise<void> {
  const encryptedToken = encrypt(params.accessToken);

  await db.tenantWhatsAppConfig.upsert({
    where: { tenantId: params.tenantId },
    create: {
      tenantId: params.tenantId,
      phoneNumberId: params.phoneNumberId,
      accessToken: encryptedToken,
      businessName: params.businessName,
      isEnabled: params.isEnabled ?? false,
    },
    update: {
      phoneNumberId: params.phoneNumberId,
      accessToken: encryptedToken,
      businessName: params.businessName,
      isEnabled: params.isEnabled ?? false,
      updatedAt: new Date(),
    },
  });
}

/**
 * Send a WhatsApp message using Meta Cloud API
 * Returns the external message ID if successful, null otherwise
 */
export async function sendWhatsAppMessage(
  config: WhatsAppConfig,
  toPhone: string,
  params: {
    templateName?: string;
    content: string;
  },
): Promise<string | null> {
  try {
    // Normalize phone number to E.164 format if needed
    const normalizedPhone = normalizePhoneNumber(toPhone);
    if (!normalizedPhone) {
      console.error("[WhatsApp] Invalid phone number format:", toPhone);
      return null;
    }

    const url = `https://graph.facebook.com/v18.0/${config.phoneNumberId}/messages`;
    
    const body = params.templateName
      ? {
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "template",
          template: {
            name: params.templateName,
            language: { code: "en" },
          },
        }
      : {
          messaging_product: "whatsapp",
          to: normalizedPhone,
          type: "text",
          text: {
            body: params.content,
          },
        };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("[WhatsApp] API error:", data);
      return null;
    }

    return data.messages?.[0]?.id ?? null;
  } catch (error) {
    console.error("[WhatsApp] Send failed:", error);
    return null;
  }
}

/**
 * Normalize phone number to E.164 format
 * Handles various formats: +971501234567, 971501234567, 0501234567
 */
function normalizePhoneNumber(phone: string): string | null {
  if (!phone) return null;
  
  const cleaned = phone.replace(/[^0-9]/g, "");
  
  // UAE/India numbers typically 10-12 digits
  if (cleaned.length < 10 || cleaned.length > 15) {
    return null;
  }

  // If already has country code (starts with country prefix)
  if (cleaned.startsWith("971") || cleaned.startsWith("91")) {
    return `+${cleaned}`;
  }

  // Assume UAE (971) if 10 digits starting with 0
  if (cleaned.length === 10 && cleaned.startsWith("0")) {
    return `+971${cleaned.substring(1)}`;
  }

  // Assume India (91) if 10 digits
  if (cleaned.length === 10) {
    return `+91${cleaned}`;
  }

  // Default: add + if not present
  return `+${cleaned}`;
}

/**
 * Record a WhatsApp message in the database
 */
export async function recordWhatsAppMessage(params: {
  tenantId: string;
  patientId: string;
  appointmentId?: string;
  direction: "IN" | "OUT";
  templateName?: string;
  content: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  externalMessageId?: string;
}): Promise<void> {
  await db.whatsAppMessage.create({
    data: {
      tenantId: params.tenantId,
      patientId: params.patientId,
      appointmentId: params.appointmentId,
      direction: params.direction,
      templateName: params.templateName,
      content: params.content,
      status: params.status,
      externalMessageId: params.externalMessageId,
    },
  });
}

/**
 * Get WhatsApp messages for a patient
 */
export async function getPatientWhatsAppMessages(
  tenantId: string,
  patientId: string,
): Promise<Array<{
  id: string;
  direction: "IN" | "OUT";
  content: string;
  status: "SENT" | "DELIVERED" | "READ" | "FAILED";
  createdAt: Date;
  templateName?: string;
}>> {
  const messages = await db.whatsAppMessage.findMany({
    where: {
      tenantId,
      patientId,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      id: true,
      direction: WhatsAppDirection,
      content: true,
      status: WhatsAppStatus,
      createdAt: true,
      templateName: true,
    },
  });

  return messages;
}

/**
 * Update WhatsApp message status
 */
export async function updateWhatsAppMessageStatus(
  externalMessageId: string,
  status: "SENT" | "DELIVERED" | "READ" | "FAILED",
): Promise<void> {
  await db.whatsAppMessage.updateMany({
    where: { externalMessageId },
    data: { status },
  });
}
