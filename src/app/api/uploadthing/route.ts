export const runtime = "nodejs";

import { createRouteHandler } from "uploadthing/next";
import { ourFileRouter } from "./core";
import { getUploadthingToken } from "@/lib/uploadthing-env";

const token = getUploadthingToken();

export const { GET, POST } = createRouteHandler({
  router: ourFileRouter,
  config: token ? { token } : undefined,
});
