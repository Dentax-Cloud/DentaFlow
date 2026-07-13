export const runtime = "nodejs";

import type { NextRequest } from "next/server";
import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";
import { getUploadthingConfig } from "@/lib/uploadthing-env";

async function routeWithResolvedToken(
  request: NextRequest,
  method: "GET" | "POST",
): Promise<Response> {
  const config = await getUploadthingConfig();
  if (!config) {
    return Response.json({ error: "UploadThing is not configured" }, { status: 503 });
  }

  // Behind nginx, request Host inference can be wrong — pin the public callback URL.
  const callbackUrl =
    process.env.UPLOADTHING_CALLBACK_URL?.trim() ||
    (process.env.NEXTAUTH_URL
      ? `${process.env.NEXTAUTH_URL.replace(/\/$/, "")}/api/uploadthing`
      : undefined);

  const handler = createRouteHandler({
    router: ourFileRouter,
    config: {
      token: config.token,
      ...(callbackUrl ? { callbackUrl } : {}),
    },
  });

  return method === "GET" ? handler.GET(request) : handler.POST(request);
}

export async function GET(request: NextRequest) {
  return routeWithResolvedToken(request, "GET");
}

export async function POST(request: NextRequest) {
  return routeWithResolvedToken(request, "POST");
}
