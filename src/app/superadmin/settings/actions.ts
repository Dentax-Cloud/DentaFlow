"use server";

import { requireSuperAdmin } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  getSettingsDisplay,
  upsertSetting,
  clearSetting,
  seedPlatformDefaults,
  getSetting,
  SETTING_DEFINITIONS,
  type SettingKey,
  type SettingDisplay,
} from "@/lib/settings/platform-settings";

export async function getSettingsByCategory(category: string) {
  await requireSuperAdmin();
  return getSettingsDisplay(category);
}

export async function saveSetting(key: string, value: string) {
  const userId = await requireSuperAdmin();
  await upsertSetting(key as SettingKey, value, userId);
  console.info("[PlatformSettings] updated", { key, userId });
  revalidatePath("/superadmin/settings");
}

export async function removeSetting(key: string) {
  const userId = await requireSuperAdmin();
  await clearSetting(key as SettingKey);
  console.info("[PlatformSettings] cleared", { key, userId });
  revalidatePath("/superadmin/settings");
}

export async function initializePlatformDefaults() {
  await requireSuperAdmin();
  await seedPlatformDefaults();
  revalidatePath("/superadmin/settings");
  return { success: true };
}

export async function getSettingsOverview(): Promise<
  Array<{
    label: string;
    key: SettingKey;
    icon: string;
    isConfigured: boolean;
    source: SettingDisplay["source"];
  }>
> {
  await requireSuperAdmin();

  const items: Array<{
    label: string;
    key: SettingKey;
    icon: string;
    isToggle?: boolean;
  }> = [
    { label: "AI", key: "OPENAI_API_KEY", icon: "🤖" },
    { label: "Email", key: "SMTP_HOST", icon: "📧" },
    { label: "Storage", key: "UPLOADTHING_TOKEN", icon: "📁" },
    { label: "Stripe", key: "STRIPE_SECRET_KEY", icon: "💳" },
    { label: "SMS", key: "TWILIO_AUTH_TOKEN", icon: "📱" },
    { label: "AI On", key: "AI_ENABLED", icon: "⚡", isToggle: true },
  ];

  const displays = await Promise.all(
    items.map(async (item) => {
      const [value, display] = await Promise.all([
        getSetting(item.key),
        getSettingsDisplay(SETTING_DEFINITIONS[item.key].category).then((rows) =>
          rows.find((r) => r.key === item.key),
        ),
      ]);

      const isConfigured = item.isToggle
        ? value === "true"
        : Boolean(value && value.trim());

      return {
        label: item.label,
        key: item.key,
        icon: item.icon,
        isConfigured,
        source: display?.source ?? "none",
      };
    }),
  );

  return displays;
}

export async function testOpenAI(): Promise<{ success: boolean; message: string }> {
  await requireSuperAdmin();

  const apiKey = await getSetting("OPENAI_API_KEY");
  if (!apiKey) {
    return { success: false, message: "No API key configured" };
  }

  try {
    const { default: OpenAI } = await import("openai");
    const client = new OpenAI({ apiKey });
    const models = await client.models.list();
    const gptModels = models.data.filter((m) => m.id.includes("gpt"));
    return {
      success: true,
      message: `Connected ✓ — ${gptModels.length} GPT models available`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Connection failed";
    return {
      success: false,
      message: message.includes("401")
        ? "Invalid API key — check your key and try again"
        : message,
    };
  }
}

export async function testEmailSMTP(): Promise<{ success: boolean; message: string }> {
  await requireSuperAdmin();

  try {
    const { getMailTransporter } = await import("@/lib/mail/send");
    const transporter = await getMailTransporter();
    if (!transporter) {
      return { success: false, message: "Email not configured" };
    }
    await transporter.verify();
    return { success: true, message: "SMTP connection verified ✓" };
  } catch (err: unknown) {
    return {
      success: false,
      message: err instanceof Error ? err.message : "SMTP connection failed",
    };
  }
}

export async function sendTestEmail(
  toEmail: string,
): Promise<{ success: boolean; message: string }> {
  await requireSuperAdmin();

  const { sendMail } = await import("@/lib/mail/send");
  const sent = await sendMail({
    to: toEmail,
    subject: "DentaFlow Platform — Test email",
    text: [
      "This is a test email from DentaFlow Platform Settings.",
      "",
      "If you received this, your SMTP configuration is working correctly.",
      "",
      `Sent at: ${new Date().toLocaleString()}`,
    ].join("\n"),
  });

  return sent
    ? { success: true, message: `Test email sent to ${toEmail} ✓` }
    : { success: false, message: "Failed to send — check SMTP settings" };
}

export async function testStripe(): Promise<{ success: boolean; message: string }> {
  await requireSuperAdmin();

  try {
    const { getStripeClient } = await import("@/lib/stripe");
    const stripe = await getStripeClient();
    if (!stripe) {
      return { success: false, message: "Stripe not configured" };
    }
    await stripe.products.list({ limit: 1 });
    return { success: true, message: "Stripe connection verified ✓" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe connection failed";
    return {
      success: false,
      message: message.includes("Invalid API Key") ? "Invalid Stripe key — check your key" : message,
    };
  }
}

export async function testUploadThing(): Promise<{ success: boolean; message: string }> {
  await requireSuperAdmin();

  const { getUploadthingConfig } = await import("@/lib/uploadthing-env");
  const config = await getUploadthingConfig();
  if (!config) {
    return { success: false, message: "UploadThing not configured (token missing or storage disabled)" };
  }

  try {
    const { getUTApi } = await import("@/lib/uploadthing-server");
    const result = await (await getUTApi()).listFiles({ limit: 1 });
    return {
      success: true,
      message: `Connected ✓ — API reachable (${result.files.length} file(s) listed)`,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "UploadThing connection failed";
    return {
      success: false,
      message: message.toLowerCase().includes("unauthorized")
        ? "Invalid token — check your UploadThing v7 API key"
        : message,
    };
  }
}
