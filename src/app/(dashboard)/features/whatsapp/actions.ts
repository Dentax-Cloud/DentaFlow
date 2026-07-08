"use server";

import { db } from "@/lib/db";
import { requireTenantContext } from "@/lib/tenant/context";
import { 
  getWhatsAppConfig, 
  sendWhatsAppMessage, 
  recordWhatsAppMessage,
  type WhatsAppDirection,
  type WhatsAppStatus 
} from "@/lib/whatsapp/client";
import { CampaignChannel } from "@prisma/client";

/**
 * Send a WhatsApp message to a patient
 * Skips silently if WhatsApp is not configured or patient has no phone number
 * This follows the same pattern as email notifications
 */
export async function sendPatientWhatsApp(params: {
  patientId: string;
  appointmentId?: string;
  templateName?: string;
  content: string;
}): Promise<{ success: boolean; messageId?: string }> {
  try {
    const ctx = await requireTenantContext();

    // Get patient phone number
    const patient = await db.patient.findUnique({
      where: { id: params.patientId },
      select: { phone: true },
    });

    if (!patient?.phone) {
      console.log(`[WhatsApp] Patient ${params.patientId} has no phone number, skipping`);
      return { success: false };
    }

    // Get WhatsApp config
    const config = await getWhatsAppConfig(ctx.tenant.id);
    if (!config) {
      console.log(`[WhatsApp] WhatsApp not configured for tenant ${ctx.tenant.id}, skipping`);
      return { success: false };
    }

    // Send message
    const externalMessageId = await sendWhatsAppMessage(config, patient.phone, {
      templateName: params.templateName,
      content: params.content,
    });

    if (!externalMessageId) {
      console.error(`[WhatsApp] Failed to send message to patient ${params.patientId}`);
      return { success: false };
    }

    // Record message
    await recordWhatsAppMessage({
      tenantId: ctx.tenant.id,
      patientId: params.patientId,
      appointmentId: params.appointmentId,
      direction: "OUT",
      templateName: params.templateName,
      content: params.content,
      status: "SENT",
      externalMessageId,
    });

    return { success: true, messageId: externalMessageId };
  } catch (error) {
    console.error("[WhatsApp] sendPatientWhatsApp error:", error);
    return { success: false };
  }
}

/**
 * Send appointment confirmation via WhatsApp
 */
export async function sendAppointmentConfirmationWhatsApp(params: {
  patientId: string;
  appointmentId: string;
  patientName: string;
  clinicName: string;
  appointmentDate: Date;
  appointmentTime: string;
  doctorName: string;
}): Promise<void> {
  const content = `Hi ${params.patientName}, your appointment at ${params.clinicName} is confirmed for ${params.appointmentDate.toDateString()} at ${params.appointmentTime} with Dr. ${params.doctorName}. Please arrive 10 minutes early.`;

  await sendPatientWhatsApp({
    patientId: params.patientId,
    appointmentId: params.appointmentId,
    templateName: "appointment_confirmation",
    content,
  });
}

/**
 * Send appointment reminder via WhatsApp
 */
export async function sendAppointmentReminderWhatsApp(params: {
  patientId: string;
  appointmentId: string;
  patientName: string;
  clinicName: string;
  appointmentDate: Date;
  appointmentTime: string;
  doctorName: string;
  hoursBefore: number;
}): Promise<void> {
  const timeText = params.hoursBefore === 24 ? "tomorrow" : "in 1 hour";
  const content = `Reminder: Hi ${params.patientName}, you have an appointment ${timeText} at ${params.appointmentTime} with Dr. ${params.doctorName} at ${params.clinicName}. Please reply CONFIRM to confirm or RESCHEDULE to change.`;

  await sendPatientWhatsApp({
    patientId: params.patientId,
    appointmentId: params.appointmentId,
    templateName: "appointment_reminder",
    content,
  });
}

/**
 * Save WhatsApp configuration for tenant
 */
export async function saveTenantWhatsAppConfig(params: {
  phoneNumberId: string;
  accessToken: string;
  businessName?: string;
  isEnabled?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requireTenantContext();

    const { saveWhatsAppConfig } = await import("@/lib/whatsapp/client");
    await saveWhatsAppConfig({
      tenantId: ctx.tenant.id,
      phoneNumberId: params.phoneNumberId,
      accessToken: params.accessToken,
      businessName: params.businessName,
      isEnabled: params.isEnabled ?? true,
    });

    return { success: true };
  } catch (error) {
    console.error("[WhatsApp] saveTenantWhatsAppConfig error:", error);
    return { success: true, error: error instanceof Error ? error.message : "Failed to save config" };
  }
}

/**
 * Get current WhatsApp configuration for tenant
 */
export async function getTenantWhatsAppConfig() {
  try {
    const ctx = await requireTenantContext();
    const config = await db.tenantWhatsAppConfig.findUnique({
      where: { tenantId: ctx.tenant.id },
      select: {
        phoneNumberId: true,
        businessName: true,
        isEnabled: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return { success: true, config };
  } catch (error) {
    console.error("[WhatsApp] getTenantWhatsAppConfig error:", error);
    return { success: false, config: null };
  }
}

/**
 * Test WhatsApp configuration by sending a test message
 */
export async function testWhatsAppConfig(params: {
  phoneNumberId: string;
  accessToken: string;
  testPhone: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const { sendWhatsAppMessage } = await import("@/lib/whatsapp/client");
    
    const config = {
      phoneNumberId: params.phoneNumberId,
      accessToken: params.accessToken,
      isEnabled: true,
    };

    const externalMessageId = await sendWhatsAppMessage(config, params.testPhone, {
      content: "This is a test message from DentaFlow. Your WhatsApp integration is working!",
    });

    if (!externalMessageId) {
      return { success: false, error: "Failed to send test message" };
    }

    return { success: true };
  } catch (error) {
    console.error("[WhatsApp] testWhatsAppConfig error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Test failed" };
  }
}

/**
 * Get WhatsApp messages for a patient
 */
export async function getPatientWhatsAppMessages(patientId: string) {
  try {
    const ctx = await requireTenantContext();
    const { getPatientWhatsAppMessages } = await import("@/lib/whatsapp/client");
    
    const messages = await getPatientWhatsAppMessages(ctx.tenant.id, patientId);
    return { success: true, messages };
  } catch (error) {
    console.error("[WhatsApp] getPatientWhatsAppMessages error:", error);
    return { success: false, messages: [] };
  }
}

/**
 * Send a reply to a patient via WhatsApp
 */
export async function replyToPatientWhatsApp(params: {
  patientId: string;
  content: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const ctx = await requireTenantContext();

    // Get patient phone number
    const patient = await db.patient.findUnique({
      where: { id: params.patientId },
      select: { phone: true },
    });

    if (!patient?.phone) {
      return { success: false, error: "Patient has no phone number" };
    }

    // Get WhatsApp config
    const config = await getWhatsAppConfig(ctx.tenant.id);
    if (!config) {
      return { success: false, error: "WhatsApp not configured" };
    }

    // Send message
    const externalMessageId = await sendWhatsAppMessage(config, patient.phone, {
      content: params.content,
    });

    if (!externalMessageId) {
      return { success: false, error: "Failed to send message" };
    }

    // Record message
    await recordWhatsAppMessage({
      tenantId: ctx.tenant.id,
      patientId: params.patientId,
      direction: "OUT",
      content: params.content,
      status: "SENT",
      externalMessageId,
    });

    return { success: true };
  } catch (error) {
    console.error("[WhatsApp] replyToPatientWhatsApp error:", error);
    return { success: false, error: error instanceof Error ? error.message : "Failed to send reply" };
  }
}
