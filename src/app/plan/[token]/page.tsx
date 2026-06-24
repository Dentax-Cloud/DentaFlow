export const runtime = "nodejs";

import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import { serializeDecimal } from "@/lib/utils/serialize";
import { getVisitNumber } from "@/lib/clinical/treatment-plan-types";

export default async function PublicPlanPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const share = await db.treatmentPlanShare.findUnique({
    where: { token },
    include: {
      plan: {
        include: {
          items: { orderBy: [{ visitNumber: "asc" }, { priority: "asc" }] },
          patient: { select: { firstName: true, lastName: true } },
          tenant: { select: { name: true, phone: true, email: true } },
        },
      },
    },
  });

  if (!share || share.expiresAt < new Date()) notFound();

  await db.treatmentPlanShare
    .update({
      where: { token },
      data: { viewedAt: new Date() },
    })
    .catch(() => null);

  const plan = share.plan;
  const items = plan.items.map(serializeDecimal);
  const total = items.reduce((sum, i) => sum + Number(i.totalCost ?? 0), 0);

  const visits = items.reduce(
    (acc, item) => {
      const v = getVisitNumber(item);
      if (!acc[v]) acc[v] = [];
      acc[v].push(item);
      return acc;
    },
    {} as Record<number, typeof items>,
  );

  const visitEntries = Object.entries(visits).sort(
    ([a], [b]) => Number(a) - Number(b),
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{plan.tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[plan.tenant.phone, plan.tenant.email].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="mb-4 rounded-xl border bg-white p-6">
          <h2 className="text-xl font-bold">{plan.title}</h2>
          <p className="mt-1 text-muted-foreground">
            Prepared for {plan.patient.firstName} {plan.patient.lastName}
          </p>
          {plan.description && (
            <p className="mt-3 text-sm text-gray-600">{plan.description}</p>
          )}
        </div>

        {visitEntries.map(([visitNum, visitItems]) => {
          const visitTotal = visitItems.reduce(
            (sum, i) => sum + Number(i.totalCost ?? 0),
            0,
          );
          return (
            <div key={visitNum} className="mb-4 rounded-xl border bg-white p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="font-semibold">Visit {visitNum}</h3>
                <span className="text-sm font-medium">AED {visitTotal.toFixed(2)}</span>
              </div>
              <div className="space-y-3">
                {visitItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start justify-between border-b py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{item.description}</p>
                      {item.toothNumbers?.length > 0 && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Tooth {item.toothNumbers.join(", ")}
                        </p>
                      )}
                    </div>
                    <span className="ml-4 flex-shrink-0 text-sm font-semibold">
                      AED {Number(item.totalCost ?? 0).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <div className="rounded-xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold">Total estimate</span>
            <span className="text-2xl font-bold">AED {total.toFixed(2)}</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            * This is an estimate only. Final costs may vary based on actual treatment
            required.
          </p>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Questions? Contact {plan.tenant.name}
          {plan.tenant.phone ? ` at ${plan.tenant.phone}` : ""}
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          This link expires on {share.expiresAt.toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
