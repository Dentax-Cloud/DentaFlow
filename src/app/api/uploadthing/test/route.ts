import { getServerAuthSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/tenant/config";
import { getUploadthingToken } from "@/lib/uploadthing-env";
import { getUTApi } from "@/lib/uploadthing-server";

function canRunUploadthingTest(userId: string | null): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  return userId !== null && isSuperAdmin(userId);
}

export async function GET() {
  const session = await getServerAuthSession();
  const userId = session?.user?.id ?? null;
  if (!canRunUploadthingTest(userId)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!getUploadthingToken()) {
    return Response.json(
      { error: "UPLOADTHING_TOKEN is not configured" },
      { status: 503 },
    );
  }

  try {
    const result = await getUTApi().listFiles({ limit: 1 });
    return Response.json({
      ok: true,
      filesListed: result.files.length,
      hasMore: result.hasMore,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "UploadThing token validation failed";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function POST() {
  return GET();
}
