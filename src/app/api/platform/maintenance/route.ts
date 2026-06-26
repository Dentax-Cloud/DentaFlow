import { NextResponse } from "next/server";
import { isMaintenanceMode } from "@/lib/settings/platform-settings";

export const runtime = "nodejs";

export async function GET() {
  try {
    const maintenance = await isMaintenanceMode();
    return NextResponse.json({ maintenance });
  } catch {
    return NextResponse.json({ maintenance: false });
  }
}
