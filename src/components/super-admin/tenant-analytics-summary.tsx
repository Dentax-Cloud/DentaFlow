import { Building2, Users, Calendar, DollarSign, Clock, Ban } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { PlatformAnalytics } from "@/lib/super-admin/queries";

type Props = { analytics: PlatformAnalytics };

const formatCurrency = (n: number) =>
  new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 0 }).format(n);

export function TenantAnalyticsSummary({ analytics }: Props) {
  const cards = [
    {
      label: "Total Tenants",
      value: analytics.totalTenants,
      sub: `${analytics.activeTenants} active`,
      icon: Building2,
      accent: "text-dental",
    },
    {
      label: "Total Patients",
      value: analytics.totalPatients.toLocaleString(),
      sub: "Across all clinics",
      icon: Users,
      accent: "text-violet-600",
    },
    {
      label: "Appointments",
      value: analytics.totalAppointments.toLocaleString(),
      sub: "Platform-wide",
      icon: Calendar,
      accent: "text-emerald-600",
    },
    {
      label: "Clinic Revenue",
      value: formatCurrency(analytics.totalRevenue),
      sub: "Patient payments collected",
      icon: DollarSign,
      accent: "text-amber-600",
    },
    {
      label: "Pending Approval",
      value: analytics.pendingTenants,
      sub: "Awaiting activation",
      icon: Clock,
      accent: "text-amber-500",
    },
    {
      label: "Suspended",
      value: analytics.suspendedTenants,
      sub: "Restricted access",
      icon: Ban,
      accent: "text-red-500",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.label} className="border-border/60 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {card.label}
              </CardTitle>
              <Icon className={`h-4 w-4 ${card.accent}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold tracking-tight">{card.value}</div>
              <p className="text-xs text-muted-foreground">{card.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
