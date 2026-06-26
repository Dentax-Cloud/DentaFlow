export const runtime = "nodejs";

import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const setting = await db.platformSetting.findUnique({
      where: { key: "MAINTENANCE_MODE" },
      select: { value: true },
    });
    return NextResponse.json({
      maintenance: setting?.value === "true",
    });
  } catch {
    return NextResponse.json({ maintenance: false });
  }
}
