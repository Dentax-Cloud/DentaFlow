import { Users, UserCircle, Building2, Receipt } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Usage = {
  patients: { used: number; limit: number };
  users: { used: number; limit: number };
  branches: { used: number; limit: number };
  appointments: number;
  invoices: number;
};

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const unlimited = limit < 0;
  const pct = unlimited ? 15 : Math.min(100, Math.round((used / limit) * 100));
  const nearLimit = !unlimited && pct >= 80;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {used.toLocaleString()}
          {!unlimited && ` / ${limit.toLocaleString()}`}
          {unlimited && " · Unlimited"}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all ${nearLimit ? "bg-amber-500" : "bg-dental"}`}
          style={{ width: `${unlimited ? 15 : pct}%` }}
        />
      </div>
    </div>
  );
}

export function UsageMetrics({ usage }: { usage: Usage }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Patients</CardTitle>
          <Users className="h-4 w-4 text-dental" />
        </CardHeader>
        <CardContent>
          <UsageBar used={usage.patients.used} limit={usage.patients.limit} label="Patient records" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Team</CardTitle>
          <UserCircle className="h-4 w-4 text-violet-600" />
        </CardHeader>
        <CardContent>
          <UsageBar used={usage.users.used} limit={usage.users.limit} label="Active users" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Branches</CardTitle>
          <Building2 className="h-4 w-4 text-emerald-600" />
        </CardHeader>
        <CardContent>
          <UsageBar used={usage.branches.used} limit={usage.branches.limit} label="Clinic locations" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Invoices</CardTitle>
          <Receipt className="h-4 w-4 text-amber-600" />
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold tabular-nums">{usage.invoices.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Patient billing records</p>
        </CardContent>
      </Card>
    </div>
  );
}
