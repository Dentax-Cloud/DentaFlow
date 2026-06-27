import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const ALGORITHM = "aes-256-gcm";
const CURRENT_KEY_VERSION = "v1";

function getEncryptionKey(version = "v1"): Buffer {
  const rawKey = process.env.SETTINGS_ENCRYPTION_KEY;
  if (!rawKey) {
    const fallback = process.env.AUTH_SECRET;
    if (!fallback) {
      throw new Error("Neither SETTINGS_ENCRYPTION_KEY nor AUTH_SECRET is set");
    }
    console.warn(
      "[Settings] SETTINGS_ENCRYPTION_KEY not set — falling back to AUTH_SECRET. " +
        "Set SETTINGS_ENCRYPTION_KEY for better security.",
    );
    return scryptSync(fallback, `dentaflow-settings-${version}`, 32);
  }
  return scryptSync(rawKey, `dentaflow-settings-${version}`, 32);
}

export function encrypt(plaintext: string): string {
  if (!plaintext) throw new Error("Cannot encrypt empty value");

  const key = getEncryptionKey(CURRENT_KEY_VERSION);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const tag = cipher.getAuthTag();

  return [CURRENT_KEY_VERSION, iv.toString("hex"), tag.toString("hex"), encrypted].join(":");
}

export function decrypt(stored: string): string {
  if (!stored) throw new Error("Cannot decrypt empty value");

  const parts = stored.split(":");

  if (parts.length === 4 && parts[0].startsWith("v")) {
    const [version, ivHex, tagHex, ciphertext] = parts;
    const key = getEncryptionKey(version);
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  if (parts.length === 3) {
    const [ivHex, tagHex, ciphertext] = parts;
    const key = getEncryptionKey("v1");
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  throw new Error(`Unknown encryption format: ${parts.length} parts`);
}

export function maskValue(value: string): string {
  if (!value || value.length <= 10) return "••••••••••••••••";
  return value.substring(0, 6) + "••••••••" + value.substring(value.length - 4);
}

export function isEncryptedFormat(value: string): boolean {
  const parts = value.split(":");
  return (parts.length === 4 && parts[0].startsWith("v")) || parts.length === 3;
}

export async function rotateEncryption(
  getSettings: () => Promise<
    Array<{ key: string; value: string | null; encrypted: boolean }>
  >,
  updateSetting: (key: string, encryptedValue: string, version: string) => Promise<void>,
): Promise<{ rotated: number; errors: string[] }> {
  const settings = await getSettings();
  const encrypted = settings.filter((s) => s.encrypted && s.value);
  const errors: string[] = [];
  let rotated = 0;

  for (const setting of encrypted) {
    try {
      const plaintext = decrypt(setting.value!);
      const newEncrypted = encrypt(plaintext);
      await updateSetting(setting.key, newEncrypted, CURRENT_KEY_VERSION);
      rotated++;
    } catch (err) {
      errors.push(`${setting.key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { rotated, errors };
}
