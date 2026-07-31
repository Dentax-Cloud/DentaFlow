import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Stethoscope,
  Users,
  Receipt,
  Package,
  BarChart3,
  Settings,
  AlertTriangle,
  Timer,
  Truck,
} from "lucide-react";
import type { StoreDashboardStats } from "@/app/(dashboard)/features/dashboard/queries";

type KPIs = {
  todayAppointments: number;
  completedToday: number;
  pendingInvoices: number;
  revenueThisMonth: number;
  chairUtilization: number;
  patientCount: number;
  inChairNow: number;
  totalChairs: number;
};

export function AdminDashboardHome({
  kpis,
  tenantName,
}: {
  kpis: KPIs;
  tenantName: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{tenantName}</h1>
        <p className="text-muted-foreground">Clinic overview — full access</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Today's appointments" value={kpis.todayAppointments} icon={Calendar} />
        <StatCard title="Active patients" value={kpis.patientCount} icon={Users} />
        <StatCard title="Pending invoices" value={kpis.pendingInvoices} icon={Receipt} />
        <StatCard title="Chair utilization" value={`${kpis.chairUtilization}%`} icon={Stethoscope} />
      </div>
      <QuickLinks
        links={[
          { href: "/reports", label: "Reports", icon: BarChart3 },
          { href: "/admin", label: "Team & settings", icon: Settings },
          { href: "/billing", label: "Billing", icon: Receipt },
        ]}
      />
    </div>
  );
}

export function DoctorDashboardHome({ kpis }: { kpis: KPIs }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Clinical workspace</h1>
        <p className="text-muted-foreground">Odontogram, charts, and today&apos;s schedule</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Today's appointments" value={kpis.todayAppointments} icon={Calendar} />
        <StatCard title="In chair now" value={kpis.inChairNow} icon={Stethoscope} />
        <StatCard title="Active patients" value={kpis.patientCount} icon={Users} />
      </div>
      <QuickLinks
        links={[
          { href: "/clinical", label: "Open odontogram", icon: Stethoscope },
          { href: "/appointments", label: "View schedule", icon: Calendar },
          { href: "/patients", label: "Patient records", icon: Users },
        ]}
      />
    </div>
  );
}

export function ReceptionistDashboardHome({ kpis }: { kpis: KPIs }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Front desk</h1>
        <p className="text-muted-foreground">Scheduling, check-in, and patient intake</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Today's appointments" value={kpis.todayAppointments} icon={Calendar} />
        <StatCard title="Completed today" value={kpis.completedToday} icon={Calendar} />
        <StatCard title="Active patients" value={kpis.patientCount} icon={Users} />
      </div>
      <QuickLinks
        links={[
          { href: "/appointments", label: "Manage appointments", icon: Calendar },
          { href: "/patients", label: "Register patient", icon: Users },
          { href: "/crm", label: "Follow-ups", icon: Users },
        ]}
      />
    </div>
  );
}

export function FinanceDashboardHome({ kpis }: { kpis: KPIs }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Finance desk</h1>
        <p className="text-muted-foreground">Invoices, payments, and revenue reports</p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard title="Pending invoices" value={kpis.pendingInvoices} icon={Receipt} />
        <StatCard title="Revenue (month)" value={kpis.revenueThisMonth} icon={Receipt} formatCurrency />
        <StatCard title="Active patients" value={kpis.patientCount} icon={Users} />
      </div>
      <QuickLinks
        links={[
          { href: "/billing", label: "Billing & invoices", icon: Receipt },
          { href: "/reports", label: "Financial reports", icon: BarChart3 },
          { href: "/patients", label: "Patient accounts", icon: Users },
        ]}
      />
    </div>
  );
}

export function StoreDashboardHome({ stats }: { stats: StoreDashboardStats }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Store & inventory</h1>
        <p className="text-muted-foreground">Stock levels, suppliers, and reorder alerts</p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Inventory items" value={stats.itemCount} icon={Package} />
        <StatCard title="Low / reorder alerts" value={stats.lowStockCount} icon={AlertTriangle} />
        <StatCard title="Suppliers" value={stats.supplierCount} icon={Truck} />
        <StatCard title="Expiring batches (30d)" value={stats.expiringBatchCount} icon={Timer} />
      </div>
      <QuickLinks
        links={[
          { href: "/inventory", label: "Manage inventory", icon: Package },
          { href: "/inventory/suppliers", label: "Suppliers", icon: Truck },
          { href: "/inventory/expiry", label: "Expiry alerts", icon: Timer },
          { href: "/inventory/count", label: "Stock count", icon: BarChart3 },
        ]}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon: Icon,
  formatCurrency = false,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  formatCurrency?: boolean;
}) {
  const display =
    formatCurrency && typeof value === "number"
      ? new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(value)
      : value;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{display}</div>
      </CardContent>
    </Card>
  );
}

function QuickLinks({
  links,
}: {
  links: { href: string; label: string; icon: React.ComponentType<{ className?: string }> }[];
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
        <CardDescription>Jump to your most-used tools</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <Button key={link.href} variant="outline" asChild>
              <Link href={link.href} className="gap-2">
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            </Button>
          );
        })}
      </CardContent>
    </Card>
  );
}
