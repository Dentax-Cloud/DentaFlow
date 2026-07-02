import { getSetting } from "@/lib/settings/platform-settings";

let missingTokenWarned = false;

/** Resolve UploadThing v7 token from Platform Settings (DB) → env → none. */
export async function getUploadthingConfig(): Promise<{ token: string } | null> {
  const [token, enabled] = await Promise.all([
    getSetting("UPLOADTHING_TOKEN"),
    getSetting("STORAGE_ENABLED"),
  ]);

  const trimmed = token?.trim();
  if (!trimmed || enabled === "false") {
    return null;
  }

  return { token: trimmed };
}

export async function getUploadthingToken(): Promise<string | undefined> {
  const config = await getUploadthingConfig();
  return config?.token;
}

export async function isUploadthingConfigured(): Promise<boolean> {
  return Boolean(await getUploadthingToken());
}

export function getUploadDisabledMessage(forAdmin: boolean): string {
  return forAdmin
    ? "UploadThing token is not set — configure in Platform Settings → Storage."
    : "Photo upload is not configured. Contact your administrator.";
}

/** Log once at server startup when storage uploads are disabled. */
export async function warnUploadthingMissingOnce(): Promise<void> {
  if (missingTokenWarned || (await isUploadthingConfigured())) return;
  missingTokenWarned = true;
  console.warn(
    "[config] UploadThing token not set in Platform Settings — photo upload disabled",
  );
}

export async function requireUploadthingToken(): Promise<string> {
  const token = await getUploadthingToken();
  if (!token) {
    throw new Error(
      "Missing UploadThing token — add your v7 API token in Platform Settings → Storage",
    );
  }
  return token;
}
