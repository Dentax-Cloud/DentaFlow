/**
 * UploadThing v7 — UPLOADTHING_TOKEN required; UPLOADTHING_SECRET is v6-only.
 * UPLOADTHING_APP_ID is optional (app id is embedded in the token).
 */
let missingTokenWarned = false;

export function getUploadthingToken(): string | undefined {
  const token = process.env.UPLOADTHING_TOKEN?.trim();
  return token || undefined;
}

export function isUploadthingConfigured(): boolean {
  return Boolean(getUploadthingToken());
}

export function getUploadDisabledMessage(forAdmin: boolean): string {
  return forAdmin
    ? "UPLOADTHING_TOKEN is not set — configure in environment settings."
    : "Photo upload is not configured. Contact your administrator.";
}

/** Log once at server startup when the token is missing. */
export function warnUploadthingMissingOnce(): void {
  if (missingTokenWarned || isUploadthingConfigured()) return;
  missingTokenWarned = true;
  console.warn("[config] UPLOADTHING_TOKEN not set — photo upload disabled");
}

export function requireUploadthingToken(): string {
  const token = getUploadthingToken();
  if (!token) {
    throw new Error(
      "Missing UPLOADTHING_TOKEN — add your v7 API token from the UploadThing dashboard",
    );
  }
  return token;
}
