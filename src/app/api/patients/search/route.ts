export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await requireTenantContext();
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q")?.trim() ?? "";

  if (!q || q.length < 2) {
    return NextResponse.json({ patients: [] });
  }

  const patients = await db.patient.findMany({
    where: {
      tenantId: ctx.tenantId,
      deletedAt: null,
      OR: [
        { firstName: { contains: q, mode: "insensitive" } },
        { lastName: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { email: { contains: q, mode: "insensitive" } },
        { patientId: { contains: q, mode: "insensitive" } },
        { patientNumber: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      patientId: true,
      patientNumber: true,
      phone: true,
      email: true,
      allergies: true,
      bloodGroup: true,
      insuranceProvider: true,
      insuranceNetwork: true,
      dateOfBirth: true,
    },
    take: 10,
    orderBy: { firstName: "asc" },
  });

  return NextResponse.json({
    patients: patients.map((p) => ({
      ...p,
      dateOfBirth: p.dateOfBirth?.toISOString() ?? null,
    })),
  });
}
