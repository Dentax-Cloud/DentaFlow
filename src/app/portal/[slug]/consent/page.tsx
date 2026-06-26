export const runtime = "nodejs";

import { requirePortalContext } from "@/lib/portal/portal-context";
import { db } from "@/lib/db";
import PortalConsentClient from "./consent-client";
import { PortalNav, PortalDesktopNav } from "@/components/portal/portal-nav";

export default async function PortalConsentPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requirePortalContext(slug);

  const [plans, attachments] = await Promise.all([
    db.treatmentPlan.findMany({
      where: {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
      },
      include: {
        shares: {
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.attachment.findMany({
      where: {
        tenantId: ctx.tenantId,
        patientId: ctx.patientId,
        type: { contains: "consent", mode: "insensitive" },
        deletedAt: null,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const forms = [
    ...plans.map((p) => ({
      id: p.id,
      title: p.title ?? "Treatment plan",
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      signedAt: p.shares[0]?.acceptedAt?.toISOString() ?? null,
      shareToken: p.shares[0]?.token ?? null,
      kind: "plan" as const,
    })),
    ...attachments.map((a) => ({
      id: a.id,
      title: a.name,
      status: "ATTACHMENT",
      createdAt: a.createdAt.toISOString(),
      signedAt: null,
      shareToken: null,
      url: a.url,
      kind: "attachment" as const,
    })),
  ];

  return (
    <div className="space-y-6">
      <PortalDesktopNav slug={slug} />
      <PortalConsentClient
        forms={forms}
        patientName={`${ctx.patient.firstName} ${ctx.patient.lastName}`}
        slug={slug}
      />
      <PortalNav slug={slug} />
    </div>
  );
}
