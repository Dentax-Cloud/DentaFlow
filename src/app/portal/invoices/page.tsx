import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { auth } from "@/lib/auth/stubs/server";
import { db } from "@/lib/db";
import { resolvePortalPatientOrThrow } from "@/lib/portal/resolve-portal-patient";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getPortalPreferredPatientId } from "@/lib/portal/portal-session";
import { redirect } from "next/navigation";

export default async function PortalInvoicesPage() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Invoices & payments</h1>
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground">
            Please sign in to view invoices.
          </CardContent>
        </Card>
      </div>
    );
  }

  try {
    const preferred = await getPortalPreferredPatientId();
    const patient = await resolvePortalPatientOrThrow(userId, preferred);
    const [invoices, settings] = await Promise.all([
      db.invoice.findMany({
        where: { tenantId: patient.tenantId, patientId: patient.id, deletedAt: null },
        include: { payments: true },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
      db.settings.findUnique({ where: { tenantId: patient.tenantId } }),
    ]);

    const currency = settings?.currency ?? "USD";

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Invoices & payments</h1>
        <Card>
          <CardHeader>
            <CardTitle>
              Invoices <span className="text-muted-foreground">({invoices.length})</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {invoices.map((inv) => {
              const paid = inv.payments.reduce((s, p) => s + Number(p.amount), 0);
              const outstanding = Math.max(0, Number(inv.total) - paid);
              return (
                <div key={inv.id} className="flex items-center justify-between border-b pb-2 text-sm">
                  <div>
                    <p className="font-medium">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(inv.createdAt)} · Outstanding {formatCurrency(outstanding, currency)}
                    </p>
                  </div>
                  <Badge variant="outline">{inv.status}</Badge>
                </div>
              );
            })}
            {invoices.length === 0 && (
              <p className="text-sm text-muted-foreground">No invoices</p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    if (message === "PORTAL_MULTIPLE_CLINICS") redirect("/portal/select-clinic");
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Invoices & payments</h1>
        <Card>
          <CardHeader>
            <CardTitle>Not linked</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Your portal account isn’t linked to a clinic yet. Ask your clinic to link your Clerk
              user id to your patient record.
            </p>
            <p className="font-mono text-xs">Clerk user id: {userId}</p>
            <p className="text-xs text-muted-foreground">Error: {message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }
}
