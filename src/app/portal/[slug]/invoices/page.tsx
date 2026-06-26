export const runtime = "nodejs";

import { requirePortalContext } from "@/lib/portal/portal-context";
import { db } from "@/lib/db";
import { serializeDecimal } from "@/lib/utils/serialize";
import { PortalNav, PortalDesktopNav } from "@/components/portal/portal-nav";

export default async function PortalInvoicesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ctx = await requirePortalContext(slug);

  const invoices = await db.invoice.findMany({
    where: {
      tenantId: ctx.tenantId,
      patientId: ctx.patientId,
    },
    include: {
      items: {
        select: { description: true, quantity: true, unitPrice: true, total: true },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <PortalDesktopNav slug={slug} />
      <h1 className="text-xl font-bold">My Invoices</h1>

      {invoices.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p className="mb-3 text-4xl">🧾</p>
          <p>No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((inv) => {
            const s = serializeDecimal(inv);
            const statusColor =
              inv.status === "PAID"
                ? "bg-green-100 text-green-700"
                : inv.status === "OVERDUE"
                  ? "bg-red-100 text-red-700"
                  : inv.status === "PARTIAL"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-yellow-100 text-yellow-700";

            return (
              <div key={inv.id} className="space-y-3 rounded-xl border bg-white p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-mono text-sm font-semibold">
                      {inv.invoiceRef ?? inv.invoiceNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(inv.createdAt).toLocaleDateString("en-AE")}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold">AED {Number(s.total ?? 0).toFixed(2)}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor}`}>
                      {inv.status}
                    </span>
                  </div>
                </div>

                <div className="space-y-1 border-t pt-3">
                  {inv.items.map((item) => (
                    <div key={item.description + item.total.toString()} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.description}
                        {item.quantity > 1 && ` ×${item.quantity}`}
                      </span>
                      <span>AED {Number(item.total).toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {inv.status !== "PAID" && (
                  <div className="border-t pt-3">
                    <p className="text-xs text-muted-foreground">
                      To pay this invoice, please contact {ctx.tenant.name}
                      {ctx.tenant.phone && ` at ${ctx.tenant.phone}`}.
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <PortalNav slug={slug} />
    </div>
  );
}
