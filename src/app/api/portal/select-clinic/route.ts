export const runtime = "nodejs";

import { auth } from "@/lib/auth/stubs/server";
import { NextResponse } from "next/server";
import { resolvePortalPatients } from "@/lib/portal/resolve-portal-patient";
import { setPortalPreferredPatientId } from "@/lib/portal/portal-session";

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.redirect(new URL("/portal/sign-in", req.url));

  const formData = await req.formData();
  const patientId = String(formData.get("patientId") ?? "");
  if (!patientId) {
    return NextResponse.redirect(new URL("/portal/select-clinic", req.url));
  }

  const matches = await resolvePortalPatients(userId);
  const found = matches.find((m) => m.id === patientId);
  if (!found) {
    return NextResponse.redirect(new URL("/portal/select-clinic", req.url));
  }

  await setPortalPreferredPatientId(patientId);
  return NextResponse.redirect(new URL("/portal", req.url));
}
