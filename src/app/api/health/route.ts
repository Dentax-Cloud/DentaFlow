import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const DB_TIMEOUT_MS = 3000;

async function checkDatabase(): Promise<"ok" | "fail"> {
  try {
    await Promise.race([
      db.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("database timeout")), DB_TIMEOUT_MS),
      ),
    ]);
    return "ok";
  } catch {
    return "fail";
  }
}

export async function GET() {
  const database = await checkDatabase();
  const status = database === "ok" ? "ok" : "down";
  const body = { status, checks: { database } };

  return NextResponse.json(body, { status: status === "ok" ? 200 : 503 });
}
