import { db } from "@/lib/db";
import { encrypt, decrypt, maskValue } from "./encrypt";

export const SETTING_DEFINITIONS = {
  OPENAI_API_KEY: {
    category: "AI",
    encrypted: true,
    envFallback: "OPENAI_API_KEY",
    description: "OpenAI API key for SOAP generation, AI enhance, insights",
    placeholder: "sk-proj-...",
    inputType: "password" as const,
  },
  OPENAI_MODEL: {
    category: "AI",
    encrypted: false,
    envFallback: null,
    description: "OpenAI model to use",
    placeholder: "gpt-4o",
    inputType: "select" as const,
    options: ["gpt-4o", "gpt-4-turbo", "gpt-3.5-turbo"],
    defaultValue: "gpt-4o",
  },
  AI_ENABLED: {
    category: "AI",
    encrypted: false,
    envFallback: null,
    description: "Master switch — enable all AI features",
    inputType: "toggle" as const,
    defaultValue: "true",
  },
  SMTP_HOST: {
    category: "EMAIL",
    encrypted: false,
    envFallback: "SMTP_HOST",
    description: "SMTP server hostname",
    placeholder: "smtp.sendgrid.net",
    inputType: "text" as const,
  },
  SMTP_PORT: {
    category: "EMAIL",
    encrypted: false,
    envFallback: "SMTP_PORT",
    description: "SMTP port (587=TLS, 465=SSL, 25=plain)",
    placeholder: "587",
    inputType: "text" as const,
  },
  SMTP_USER: {
    category: "EMAIL",
    encrypted: false,
    envFallback: "SMTP_USER",
    description: "SMTP username / login",
    placeholder: "apikey",
    inputType: "text" as const,
  },
  SMTP_PASSWORD: {
    category: "EMAIL",
    encrypted: true,
    envFallback: "SMTP_PASSWORD",
    description: "SMTP password or API key",
    placeholder: "••••••••",
    inputType: "password" as const,
  },
  SMTP_FROM_EMAIL: {
    category: "EMAIL",
    encrypted: false,
    envFallback: "SMTP_FROM",
    description: "Sender email address",
    placeholder: "noreply@yourclinic.com",
    inputType: "text" as const,
  },
  SMTP_FROM_NAME: {
    category: "EMAIL",
    encrypted: false,
    envFallback: "SMTP_FROM_NAME",
    description: "Sender display name",
    placeholder: "DentaFlow",
    inputType: "text" as const,
  },
  EMAIL_ENABLED: {
    category: "EMAIL",
    encrypted: false,
    envFallback: null,
    description: "Enable email sending platform-wide",
    inputType: "toggle" as const,
    defaultValue: "true",
  },
  UPLOADTHING_SECRET: {
    category: "STORAGE",
    encrypted: true,
    envFallback: "UPLOADTHING_SECRET",
    description: "UploadThing secret key",
    placeholder: "sk_live_...",
    inputType: "password" as const,
  },
  UPLOADTHING_APP_ID: {
    category: "STORAGE",
    encrypted: false,
    envFallback: "UPLOADTHING_APP_ID",
    description: "UploadThing app ID",
    placeholder: "abc123",
    inputType: "text" as const,
  },
  STORAGE_ENABLED: {
    category: "STORAGE",
    encrypted: false,
    envFallback: null,
    description: "Enable file uploads (radiographs, photos)",
    inputType: "toggle" as const,
    defaultValue: "true",
  },
  STRIPE_SECRET_KEY: {
    category: "STRIPE",
    encrypted: true,
    envFallback: "STRIPE_SECRET_KEY",
    description: "Stripe secret key (sk_live_... or sk_test_...)",
    placeholder: "sk_live_...",
    inputType: "password" as const,
  },
  STRIPE_PUBLISHABLE_KEY: {
    category: "STRIPE",
    encrypted: false,
    envFallback: "STRIPE_PUBLISHABLE_KEY",
    description: "Stripe publishable key (safe to expose)",
    placeholder: "pk_live_...",
    inputType: "text" as const,
  },
  STRIPE_WEBHOOK_SECRET: {
    category: "STRIPE",
    encrypted: true,
    envFallback: "STRIPE_WEBHOOK_SECRET",
    description: "Stripe webhook signing secret (whsec_...)",
    placeholder: "whsec_...",
    inputType: "password" as const,
  },
  STRIPE_ENABLED: {
    category: "STRIPE",
    encrypted: false,
    envFallback: null,
    description: "Enable Stripe subscription billing",
    inputType: "toggle" as const,
    defaultValue: "false",
  },
  TWILIO_ACCOUNT_SID: {
    category: "SMS",
    encrypted: false,
    envFallback: "TWILIO_ACCOUNT_SID",
    description: "Twilio Account SID",
    placeholder: "ACxxxxxxxxxxxxxxxx",
    inputType: "text" as const,
  },
  TWILIO_AUTH_TOKEN: {
    category: "SMS",
    encrypted: true,
    envFallback: "TWILIO_AUTH_TOKEN",
    description: "Twilio Auth Token",
    placeholder: "••••••••",
    inputType: "password" as const,
  },
  TWILIO_FROM_NUMBER: {
    category: "SMS",
    encrypted: false,
    envFallback: "TWILIO_FROM_NUMBER",
    description: "Twilio phone number (E.164 format: +971...)",
    placeholder: "+97150xxxxxxx",
    inputType: "text" as const,
  },
  SMS_ENABLED: {
    category: "SMS",
    encrypted: false,
    envFallback: null,
    description: "Enable SMS appointment reminders",
    inputType: "toggle" as const,
    defaultValue: "false",
  },
  PLATFORM_NAME: {
    category: "PLATFORM",
    encrypted: false,
    envFallback: null,
    description: "Platform display name shown to users",
    placeholder: "DentaFlow",
    inputType: "text" as const,
    defaultValue: "DentaFlow",
  },
  SUPPORT_EMAIL: {
    category: "PLATFORM",
    encrypted: false,
    envFallback: null,
    description: "Support contact email shown to tenants",
    placeholder: "support@dentaflow.io",
    inputType: "text" as const,
  },
  DEFAULT_TRIAL_DAYS: {
    category: "PLATFORM",
    encrypted: false,
    envFallback: null,
    description: "Trial period for new clinic registrations",
    placeholder: "14",
    inputType: "text" as const,
    defaultValue: "14",
  },
  ALLOW_REGISTRATIONS: {
    category: "PLATFORM",
    encrypted: false,
    envFallback: null,
    description: "Allow new clinics to self-register",
    inputType: "toggle" as const,
    defaultValue: "true",
  },
  MAINTENANCE_MODE: {
    category: "PLATFORM",
    encrypted: false,
    envFallback: null,
    description: "Block all tenant logins (use for updates)",
    inputType: "toggle" as const,
    defaultValue: "false",
    warning: "Enabling this blocks ALL clinic logins immediately",
  },
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;

type SettingDef = {
  category: string;
  encrypted: boolean;
  envFallback: string | null;
  description: string;
  placeholder?: string;
  inputType: "password" | "text" | "toggle" | "select";
  options?: readonly string[];
  defaultValue?: string;
  warning?: string;
};

export const CATEGORIES = [
  { key: "AI", label: "AI & Intelligence", icon: "🤖" },
  { key: "EMAIL", label: "Email", icon: "📧" },
  { key: "STORAGE", label: "Storage", icon: "📁" },
  { key: "STRIPE", label: "Payments", icon: "💳" },
  { key: "SMS", label: "SMS", icon: "📱" },
  { key: "PLATFORM", label: "Platform", icon: "⚙️" },
] as const;

export async function getSetting(key: SettingKey): Promise<string | null> {
  const def = SETTING_DEFINITIONS[key] as SettingDef;

  try {
    const record = await db.platformSetting.findUnique({
      where: { key },
      select: { value: true, encrypted: true },
    });

    if (record?.value) {
      if (def.encrypted && record.encrypted) {
        try {
          return decrypt(record.value);
        } catch (err) {
          console.error(`[Settings] Failed to decrypt ${key}:`, err);
        }
      } else {
        return record.value;
      }
    }
  } catch (err) {
    console.warn(`[Settings] DB unavailable for ${key}, using env`, err);
  }

  if (def.envFallback && process.env[def.envFallback]) {
    return process.env[def.envFallback]!;
  }

  return def.defaultValue ?? null;
}

export async function getSettings(
  keys: SettingKey[],
): Promise<Record<SettingKey, string | null>> {
  const result = {} as Record<SettingKey, string | null>;
  await Promise.all(
    keys.map(async (key) => {
      result[key] = await getSetting(key);
    }),
  );
  return result;
}

export type SettingDisplay = {
  key: string;
  category: string;
  description: string;
  inputType: string;
  placeholder?: string;
  options?: readonly string[];
  warning?: string;
  encrypted: boolean;
  hasValue: boolean;
  source: "db" | "env" | "default" | "none";
  displayValue: string | null;
  maskedValue: string | null;
  keyVersion: string | null;
};

export async function getSettingsDisplay(category: string): Promise<SettingDisplay[]> {
  const categoryKeys = (
    Object.entries(SETTING_DEFINITIONS) as [SettingKey, SettingDef][]
  )
    .filter(([, def]) => def.category === category)
    .map(([key]) => key);

  const records = await db.platformSetting.findMany({
    where: { key: { in: categoryKeys } },
    select: { key: true, value: true, encrypted: true, keyVersion: true },
  });

  return categoryKeys.map((key) => {
    const def = SETTING_DEFINITIONS[key] as SettingDef;
    const record = records.find((r) => r.key === key);
    const envValue = def.envFallback ? process.env[def.envFallback] : null;

    let source: SettingDisplay["source"] = "none";
    let hasValue = false;
    let displayValue: string | null = null;
    let maskedValue: string | null = null;
    let keyVersion: string | null = null;

    if (record?.value) {
      source = "db";
      hasValue = true;
      keyVersion = record.keyVersion ?? "v1";
      if (def.encrypted) {
        try {
          maskedValue = maskValue(decrypt(record.value));
        } catch {
          maskedValue = "••••••••••••••••";
        }
        displayValue = null;
      } else {
        displayValue = record.value;
      }
    } else if (envValue) {
      source = "env";
      hasValue = true;
      if (def.encrypted) {
        maskedValue = maskValue(envValue);
        displayValue = null;
      } else {
        displayValue = envValue;
      }
    } else if (def.defaultValue) {
      source = "default";
      hasValue = true;
      displayValue = def.encrypted ? null : def.defaultValue;
    }

    return {
      key,
      category: def.category,
      description: def.description,
      inputType: def.inputType,
      placeholder: def.placeholder,
      options: def.options,
      warning: def.warning,
      encrypted: def.encrypted,
      hasValue,
      source,
      displayValue,
      maskedValue,
      keyVersion,
    };
  });
}

const MASK_PLACEHOLDERS = new Set(["••••••••••••••••", "sk-proj-••••••••"]);

export async function upsertSetting(
  key: SettingKey,
  value: string,
  updatedById?: string,
): Promise<void> {
  const def = SETTING_DEFINITIONS[key] as SettingDef;

  if (MASK_PLACEHOLDERS.has(value)) return;

  let storedValue = value.trim();
  let encrypted = false;
  const keyVersion = "v1";

  if (def.encrypted && storedValue) {
    storedValue = encrypt(storedValue);
    encrypted = true;
  }

  await db.platformSetting.upsert({
    where: { key },
    create: {
      key,
      value: storedValue,
      encrypted,
      keyVersion,
      category: def.category,
      description: def.description,
      updatedById: updatedById ?? null,
    },
    update: {
      value: storedValue,
      encrypted,
      keyVersion,
      updatedById: updatedById ?? null,
      updatedAt: new Date(),
    },
  });
}

export async function clearSetting(key: SettingKey): Promise<void> {
  await db.platformSetting.deleteMany({ where: { key } });
}

export async function seedPlatformDefaults(): Promise<void> {
  const defaults: Array<{ key: SettingKey; value: string }> = [
    { key: "PLATFORM_NAME", value: "DentaFlow" },
    { key: "ALLOW_REGISTRATIONS", value: "true" },
    { key: "MAINTENANCE_MODE", value: "false" },
    { key: "DEFAULT_TRIAL_DAYS", value: "14" },
    { key: "AI_ENABLED", value: "true" },
    { key: "EMAIL_ENABLED", value: "true" },
    { key: "STRIPE_ENABLED", value: "false" },
    { key: "SMS_ENABLED", value: "false" },
    { key: "OPENAI_MODEL", value: "gpt-4o" },
    { key: "STORAGE_ENABLED", value: "true" },
  ];

  for (const { key, value } of defaults) {
    const def = SETTING_DEFINITIONS[key] as SettingDef;
    await db.platformSetting.upsert({
      where: { key },
      create: {
        key,
        value,
        encrypted: false,
        keyVersion: "v1",
        category: def.category,
        description: def.description,
      },
      update: {},
    });
  }
}

export async function isMaintenanceMode(): Promise<boolean> {
  const mode = await getSetting("MAINTENANCE_MODE");
  return mode === "true";
}
