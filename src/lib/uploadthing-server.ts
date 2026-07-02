import { UTApi } from "uploadthing/server";
import { requireUploadthingToken } from "@/lib/uploadthing-env";

export async function getUTApi(): Promise<UTApi> {
  const token = await requireUploadthingToken();
  return new UTApi({ token });
}
