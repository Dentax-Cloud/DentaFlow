export const runtime = "nodejs";

import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "Patient portal is not available yet." },
    { status: 503 },
  );
}
