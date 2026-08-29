export const runtime = "nodejs";

import { notFound } from "next/navigation";
import { loadVisitSharePayload } from "@/lib/encounter/visit-share";

function money(symbol: string, amount: number): string {
  return `${symbol} ${amount.toFixed(2)}`;
}

export default async function PublicVisitPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const payload = await loadVisitSharePayload(token);
  if (!payload) notFound();

  const symbol = payload.tenant.currencySymbol;
  const billableLines = payload.estimate.lines.filter((line) => line.billable);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold">{payload.tenant.name}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {[payload.tenant.phone, payload.tenant.email].filter(Boolean).join(" · ")}
          </p>
        </div>

        <div className="mb-4 rounded-xl border bg-white p-6">
          <h2 className="text-xl font-bold">Today&apos;s visit</h2>
          <p className="mt-1 text-muted-foreground">
            Prepared for {payload.patient.firstName} {payload.patient.lastName}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            This page is read-only. Ask a member of the clinical team if you have questions.
          </p>
        </div>

        <div className="mb-4 rounded-xl border bg-white p-6">
          <h3 className="font-semibold">Consent</h3>
          <ul className="mt-3 space-y-2">
            {payload.consentItems.map((item) => (
              <li
                key={item.purpose}
                className="flex items-center justify-between border-b py-2 last:border-0"
              >
                <span className="text-sm">
                  {item.purpose === "clinical"
                    ? "Clinical treatment consent"
                    : "Marketing photo use"}
                </span>
                <span
                  className={
                    item.status === "granted"
                      ? "text-sm font-medium text-emerald-800"
                      : "text-sm font-medium text-amber-800"
                  }
                >
                  {item.status === "granted" ? "Granted" : "Pending"}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mb-4 rounded-xl border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-semibold">Running estimate</h3>
            <span className="text-sm font-medium">
              {money(symbol, payload.estimate.projectedTotal)}
            </span>
          </div>
          {billableLines.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No billable items yet. This estimate updates as treatment is recorded.
            </p>
          ) : (
            <div className="space-y-3">
              {billableLines.map((line) => (
                <div
                  key={line.id}
                  className="flex items-start justify-between border-b py-2 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {line.code} · {line.name}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {line.status.replaceAll("_", " ")}
                      {line.materialsCost > 0
                        ? ` · materials ${money(symbol, line.materialsCost)}`
                        : ""}
                    </p>
                  </div>
                  <span className="ml-4 flex-shrink-0 text-sm font-semibold">
                    {money(symbol, line.unitPrice + line.materialsCost)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center justify-between border-t pt-4">
            <span className="text-lg font-bold">Estimated total</span>
            <span className="text-2xl font-bold">
              {money(symbol, payload.estimate.projectedTotal)}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            * This is a live estimate only. Final costs may vary based on actual treatment
            required.
          </p>
        </div>

        <div className="mb-4 rounded-xl border bg-white p-6">
          <h3 className="font-semibold">Shareable photos</h3>
          {payload.photos.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              No photos are available to share for this visit.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-4">
              {payload.photos.map((img, idx) => (
                <div key={img.id} className="overflow-hidden rounded-lg border bg-gray-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.url}
                    alt={img.fileName ?? `Photo ${idx + 1}`}
                    className="aspect-square w-full object-cover"
                  />
                  {(img.photoCategory || img.notes) && (
                    <div className="p-2">
                      {img.photoCategory ? (
                        <p className="text-xs font-medium text-gray-700">
                          {img.photoCategory.replaceAll("_", " ")}
                        </p>
                      ) : null}
                      {img.notes ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{img.notes}</p>
                      ) : null}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Questions? Contact {payload.tenant.name}
          {payload.tenant.phone ? ` at ${payload.tenant.phone}` : ""}
        </p>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          This link expires on {payload.expiresOn}
        </p>
      </div>
    </div>
  );
}
