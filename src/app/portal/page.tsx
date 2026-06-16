import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Calendar, Receipt, FileText } from "lucide-react";
import { auth } from "@/lib/auth/stubs/server";
import { resolvePortalPatients } from "@/lib/portal/resolve-portal-patient";
import { Badge } from "@/components/ui/badge";
import { getPortalPreferredPatientId } from "@/lib/portal/portal-session";

export default async function PortalHomePage() {
  const { userId } = await auth();
  const matches = userId ? await resolvePortalPatients(userId) : [];
  const preferred = await getPortalPreferredPatientId();
  const selected = preferred ? matches.find((m) => m.id === preferred) : matches[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome to your patient portal</h1>
        <p className="text-muted-foreground">
          View appointments, treatment summaries, and pay invoices securely.
        </p>
        {matches.length === 0 ? (
          <Badge variant="warning" className="mt-3">
            Not linked to a clinic yet
          </Badge>
        ) : (
          <Badge variant="success" className="mt-3">
            Linked clinic: {selected?.tenant.name ?? matches[0]!.tenant.name}
          </Badge>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { href: "/portal/appointments", icon: Calendar, title: "Appointments", desc: "Upcoming visits" },
          { href: "/portal/invoices", icon: Receipt, title: "Invoices", desc: "Billing & payments" },
          { href: "/portal/treatment", icon: FileText, title: "Treatment", desc: "Plan summaries" },
        ].map((item) => (
          <Card key={item.href}>
            <CardHeader>
              <item.icon className="h-8 w-8 text-dental" />
              <CardTitle className="text-base">{item.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted-foreground">{item.desc}</p>
              <Button variant="outline" size="sm" asChild>
                <Link href={item.href}>View</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {matches.length === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Link your account</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>
              Ask your clinic to link your portal account. Staff can paste your Clerk user id into
              your patient record.
            </p>
            <p className="font-mono text-xs">Clerk user id: {userId ?? "—"}</p>
          </CardContent>
        </Card>
      )}

      <Card className="border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950">
        <CardContent className="p-4 text-sm">
          This portal provides general information only. For dental emergencies or medical
          advice, contact your clinic directly.
        </CardContent>
      </Card>
    </div>
  );
}
