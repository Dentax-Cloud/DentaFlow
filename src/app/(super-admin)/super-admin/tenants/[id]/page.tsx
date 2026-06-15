import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Mail, MapPin } from "lucide-react";
import { getTenantDetail } from "@/lib/super-admin/queries";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ImpersonateButton } from "@/components/super-admin/impersonate-button";

type Props = { params: Promise<{ id: string }> };

export default async function TenantDetailPage({ params }: Props) {
  const { id } = await params;
  const tenant = await getTenantDetail(id);
  if (!tenant) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/super-admin">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
          <p className="text-sm text-muted-foreground">{tenant.slug}</p>
        </div>
        <Badge>{tenant.status}</Badge>
        <ImpersonateButton tenantId={tenant.id} tenantName={tenant.name} />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Active Users", value: tenant._count.users },
          { label: "Patients", value: tenant._count.patients },
          { label: "Appointments", value: tenant._count.appointments },
          {
            label: "Revenue",
            value: tenant.totalRevenue.toLocaleString("en-AE", {
              style: "currency",
              currency: "AED",
              maximumFractionDigits: 0,
            }),
          },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4" />
              Clinic Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Mail className="h-4 w-4" />
              {tenant.email ?? "—"}
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {[tenant.address, tenant.city, tenant.country].filter(Boolean).join(", ") || "—"}
            </div>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <div>
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="font-medium">{tenant.subscriptionPlan}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Subscription</p>
                <p className="font-medium">{tenant.subscriptionStatus}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Created</p>
                <p className="font-medium">{tenant.createdAt.toLocaleDateString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clerk Org</p>
                <p className="truncate font-mono text-xs">{tenant.clerkOrgId}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent Staff</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {tenant.users.map((u) => (
                <li key={u.id} className="flex items-center justify-between text-sm">
                  <span>
                    {u.firstName} {u.lastName}
                  </span>
                  <Badge variant="outline">{u.role}</Badge>
                </li>
              ))}
              {tenant.users.length === 0 && (
                <p className="text-sm text-muted-foreground">No users yet.</p>
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
