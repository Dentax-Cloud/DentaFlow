/**
 * Audit encrypted PlatformSetting rows against the current runtime key.
 * Run on VPS inside web or worker container after setting SETTINGS_ENCRYPTION_KEY:
 *   docker compose -f docker-compose.prod.yml exec web pnpm verify:settings
 */
import { db } from "@/lib/db";
import { decrypt } from "@/lib/settings/encrypt";
import { SETTING_DEFINITIONS } from "@/lib/settings/platform-settings";

const ENCRYPTED_KEYS = (
  Object.entries(SETTING_DEFINITIONS) as [string, { encrypted: boolean }][]
)
  .filter(([, def]) => def.encrypted)
  .map(([key]) => key);

async function main() {
  const hasDedicated = Boolean(process.env.SETTINGS_ENCRYPTION_KEY?.trim());
  const hasAuth = Boolean(process.env.AUTH_SECRET?.trim());

  console.log("[verify:settings] Encrypted setting keys:", ENCRYPTED_KEYS.join(", "));
  console.log(
    `[verify:settings] Key source: ${
      hasDedicated
        ? "SETTINGS_ENCRYPTION_KEY"
        : hasAuth
          ? "AUTH_SECRET (fallback — must match dev if sharing DB)"
          : "NONE (will fail)"
    }`,
  );

  if (!hasDedicated && !hasAuth) {
    console.error("[verify:settings] ERROR: No decryption key available in environment.");
    process.exit(1);
  }

  const records = await db.platformSetting.findMany({
    where: { encrypted: true },
    select: { key: true, value: true },
  });

  let ok = 0;
  let fail = 0;
  let empty = 0;

  for (const key of ENCRYPTED_KEYS) {
    const record = records.find((r) => r.key === key);
    if (!record?.value) {
      console.log(`  ${key}: (not stored in DB)`);
      empty++;
      continue;
    }

    try {
      const plaintext = decrypt(record.value);
      const preview =
        plaintext.length > 8
          ? `${plaintext.slice(0, 4)}…${plaintext.slice(-4)} (${plaintext.length} chars)`
          : `(set, ${plaintext.length} chars)`;
      console.log(`  ${key}: OK — ${preview}`);
      ok++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${key}: FAIL — ${msg}`);
      fail++;
    }
  }

  console.log(`[verify:settings] Summary: ${ok} OK, ${fail} failed, ${empty} not stored`);

  if (fail > 0) {
    console.error(
      "[verify:settings] Decryption failures — SETTINGS_ENCRYPTION_KEY (or AUTH_SECRET fallback) " +
        "does not match the key used when these values were saved. Copy the exact value from " +
        "the dev stack .env.docker on this server, then recreate web + worker containers.",
    );
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("[verify:settings] Fatal:", err);
  process.exit(1);
});
