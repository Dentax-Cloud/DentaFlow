/**
 * UploadThing v7 — UPLOADTHING_TOKEN required; UPLOADTHING_SECRET is v6-only.
 * UPLOADTHING_APP_ID is optional (app id is embedded in the token).
 */
export function getUploadthingToken(): string | undefined {
  const token = process.env.UPLOADTHING_TOKEN?.trim();
  return token || undefined;
}

export function isUploadthingConfigured(): boolean {
  return Boolean(getUploadthingToken());
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
