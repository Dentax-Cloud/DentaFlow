export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { readEstimatePdf } from "@/lib/insurance/estimate-pdf-storage";
import { requirePermission } from "@/lib/rbac/guard";
import { PERMISSIONS } from "@/lib/rbac/permissions";
import { requireTenantContext } from "@/lib/tenant/context";
import { tenantWhere } from "@/lib/tenant/scoped";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ estimateId: string }> },
) {
  const { estimateId } = await params;

  const ctx = await requireTenantContext();
  await requirePermission(PERMISSIONS.clinical.read);

  const estimate = await db.treatmentEstimate.findFirst({
    where: tenantWhere(ctx.tenantId, { id: estimateId }),
    select: { id: true, tenantId: true, pdfUrl: true },
  });

  if (!estimate) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  if (estimate.tenantId !== ctx.tenantId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!estimate.pdfUrl) {
    return NextResponse.json({ error: "PDF not generated" }, { status: 404 });
  }

  const bytes = await readEstimatePdf(estimate.pdfUrl);
  if (!bytes) {
    return NextResponse.json({ error: "PDF file not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="treatment-estimate-${estimateId}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
