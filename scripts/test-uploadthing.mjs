import { UTApi } from "uploadthing/server";

const token = process.env.UPLOADTHING_TOKEN?.trim();
if (!token) {
  console.error("Missing UPLOADTHING_TOKEN");
  process.exit(1);
}

const utapi = new UTApi({ token });
const result = await utapi.listFiles({ limit: 1 });

console.log(
  JSON.stringify({
    ok: true,
    filesListed: result.files?.length ?? 0,
    hasMore: result.hasMore ?? false,
  }),
);
