export const runtime = "nodejs";

import { requirePortalContext } from "@/lib/portal/portal-context";
import { db } from "@/lib/db";
import Link from "next/link";
import { PortalNav, PortalDesktopNav } from "@/components/portal/portal-nav";

export default async function PortalEducationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requirePortalContext(slug);

  const shared = await db.casePresentation.findMany({
    where: {
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
      shareToken: { not: null },
      sharedAt: { not: null },
    },
    orderBy: { sharedAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <PortalDesktopNav slug={slug} />
      <h1 className="text-xl font-bold">Health Information</h1>
      <p className="text-sm text-muted-foreground">
        Educational content shared by {ctx.tenant.name}
      </p>

      {shared.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="mb-3 text-4xl">📚</p>
          <p>No content shared with you yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {shared.map((s) => (
            <div key={s.id} className="rounded-xl border bg-white p-5">
              <h2 className="font-semibold">{s.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Shared {s.sharedAt ? new Date(s.sharedAt).toLocaleDateString("en-AE") : ""}
              </p>
              {s.description && (
                <p className="mt-3 line-clamp-3 text-sm text-gray-600">
                  {s.description.substring(0, 200)}
                  {s.description.length > 200 ? "..." : ""}
                </p>
              )}
              {s.shareToken && (
                <Link
                  href={`/case/${s.shareToken}`}
                  target="_blank"
                  className="mt-2 block text-sm text-blue-600 hover:underline"
                >
                  View presentation →
                </Link>
              )}
            </div>
          ))}
        </div>
      )}

      <PortalNav slug={slug} />
    </div>
  );
}
