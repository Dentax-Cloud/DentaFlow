export const runtime = "nodejs";

import { getServerAuthSession } from "@/lib/auth";
import { requireTenantContext } from "@/lib/tenant/context";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function POST(request: Request) {
  const session = await getServerAuthSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const ctx = await requireTenantContext();
  const body = (await request.json()) as { batchId?: string };
  const batchId = body.batchId;

  if (!batchId) {
    return NextResponse.json({ error: "batchId is required" }, { status: 400 });
  }

  const batch = await db.importBatch.findFirst({
    where: { id: batchId, tenantId: ctx.tenantId },
  });

  if (!batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }
  if (!batch.canRollback || batch.rolledBackAt) {
    return NextResponse.json(
      { error: "This import cannot be rolled back" },
      { status: 400 },
    );
  }

  const hoursSince = (Date.now() - batch.createdAt.getTime()) / 3600000;
  if (hoursSince > 24) {
    return NextResponse.json(
      { error: "Rollback window expired (24 hours)" },
      { status: 400 },
    );
  }

  const rollbackData = batch.rollbackData as {
    createdIds: string[];
    entity: string;
  } | null;

  if (!rollbackData?.createdIds?.length) {
    return NextResponse.json(
      { error: "No rollback data available" },
      { status: 400 },
    );
  }

  let deletedCount = 0;

  if (rollbackData.entity === "PATIENT") {
    const result = await db.patient.updateMany({
      where: {
        id: { in: rollbackData.createdIds },
        tenantId: ctx.tenantId,
      },
      data: { deletedAt: new Date() },
    });
    deletedCount = result.count;
  }

  await db.importBatch.update({
    where: { id: batchId },
    data: {
      rolledBackAt: new Date(),
      canRollback: false,
    },
  });

  return NextResponse.json({
    success: true,
    deletedCount,
    message: `Rolled back ${deletedCount} ${rollbackData.entity.toLowerCase()}(s)`,
  });
}
