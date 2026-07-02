export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { warnUploadthingMissingOnce } = await import("@/lib/uploadthing-env");
    await warnUploadthingMissingOnce();
  }
}
