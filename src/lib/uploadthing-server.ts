import { UTApi } from "uploadthing/server";
import { requireUploadthingToken } from "@/lib/uploadthing-env";

let utapi: UTApi | null = null;

export function getUTApi(): UTApi {
  if (!utapi) {
    utapi = new UTApi({ token: requireUploadthingToken() });
  }
  return utapi;
}
