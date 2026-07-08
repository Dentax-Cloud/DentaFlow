"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import {
  Calendar,
  Armchair,
  DollarSign,
  FileText,
  Users,
  Sparkles,
  Stethoscope,
  Clock,
  AlertCircle,
} from "lucide-react";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";
import type { UserRole } from "@prisma/client";
import { normalizeDashboardRole } from "@/lib/rbac/permissions";
import { getAppointmentStatusLabel } from "@/lib/appointments/status-colors";
import { updateAppointmentStatus } from "@/app/(dashboard)/features/appointments/actions";
import { toast } from "sonner";

type KPIs = {
  todayAppointments: number;
  completedToday: number;
  pendingInvoices: number;
  revenueThisMonth: number;
  chairUtilization: number;
  patientCount: number;
  inChairNow: number;
  totalChairs: number;
  emergencyWaiting: number;
  emergencyImmediate: number;
};

type Extras = {
  todayAppointments: {
    id: string;
    title: string;
    status: string;
    startTime: Date;
    patientName: string;
    patientId: string;
  }[];
  waitingCount: number;
  pendingTreatmentPlans: number;
};

const statusLabel: Record<string, string> = new Proxy(
  {},
  {
    get: (_target, prop: string) => getAppointmentStatusLabel(prop),
  },
);

export function DashboardClient({
  kpis,
  extras,
  tenantName,
  plan,
  userRole,
}: {
  kpis: KPIs;
  extras: Extras;
  tenantName: string;
  plan: SubscriptionPlan;
  userRole: UserRole;
  staffMemberId: string | null;
}) {
  const dashboardRole = normalizeDashboardRole(userRole);
  const isAdminView = dashboardRole === "ADMIN";
  const isClinicalView = dashboardRole === "DOCTOR";
  const isFinanceView = dashboardRole === "FINANCE";
  const isFrontDeskView =
    dashboardRole === "RECEPTIONIST" || dashboardRole === "STORE";

  const { data: aiInsights, isLoading: aiLoading } = useQuery({
    queryKey: ["ai-insights", kpis],
    queryFn: async () => {
      const res = await fetch("/api/ai/analytics-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics: kpis }),
      });
      if (!res.ok) return null;
      const json = await res.json();
      return json.summary as string;
    },
    enabled: isAdminView && plan !== "STARTER",
    staleTime: 300_000,
  });

  async function checkIn(appointmentId: string) {
    const result = await updateAppointmentStatus({ id: appointmentId, status: "ARRIVED" });
    if (result.success) toast.success("Patient checked in");
    else toast.error(result.error);
  }

  const adminCards = [
    {
      title: "Today's appointments",
      value: kpis.todayAppointments,
      sub: `${kpis.completedToday} completed`,
      icon: Calendar,
    },
    {
      title: "Chair utilization",
      value: `${kpis.chairUtilization}%`,
      sub: `${kpis.inChairNow}/${kpis.totalChairs} chairs in use`,
      icon: Armchair,
    },
    {
      title: "Revenue (month)",
      value: formatCurrency(kpis.revenueThisMonth),
      sub: "Collected payments",
      icon: DollarSign,
    },
    {
      title: "Pending invoices",
      value: kpis.pendingInvoices,
      sub: "Awaiting payment",
      icon: FileText,
    },
    {
      title: "Active patients",
      value: kpis.patientCount,
      sub: "Total registered",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">{tenantName}</p>
      </div>

      {(isClinicalView || isFrontDeskView || isAdminView) &&
        (kpis.emergencyWaiting > 0 || kpis.emergencyImmediate > 0) && (
          <Card
            className={
              kpis.emergencyImmediate > 0
                ? "border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/30"
                : "border-yellow-300 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950/30"
            }
          >
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <AlertCircle
                  className={`h-5 w-5 ${kpis.emergencyImmediate > 0 ? "text-red-600" : "text-yellow-600"}`}
                />
                <CardTitle className="text-base">Emergency queue</CardTitle>
              </div>
              <Button size="sm" asChild>
                <Link href="/clinical/emergency">View queue</Link>
              </Button>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-4 text-sm">
              <div>
                <span className="text-2xl font-bold">{kpis.emergencyWaiting}</span>
                <span className="ml-1 text-muted-foreground">waiting</span>
              </div>
              {kpis.emergencyImmediate > 0 && (
                <div className="text-red-700">
                  <span className="text-2xl font-bold">{kpis.emergencyImmediate}</span>
                  <span className="ml-1">immediate</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

      {isFinanceView && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.pendingInvoices}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Revenue (month)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(kpis.revenueThisMonth)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active patients</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.patientCount}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {isAdminView && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {adminCards.map((card) => (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                <card.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
                <p className="text-xs text-muted-foreground">{card.sub}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isClinicalView && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">My patients today</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{extras.todayAppointments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Clinical queue</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{extras.waitingCount}</div>
              <p className="text-xs text-muted-foreground">Checked in, waiting</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Treatment plans</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{extras.pendingTreatmentPlans}</div>
              <p className="text-xs text-muted-foreground">Need action</p>
            </CardContent>
          </Card>
        </div>
      )}

      {isFrontDeskView && !isAdminView && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Today&apos;s appointments</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.todayAppointments}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Patients waiting</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{extras.waitingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Pending invoices</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{kpis.pendingInvoices}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {(isClinicalView || isFrontDeskView) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {isClinicalView ? "My schedule today" : "Today's appointments"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {extras.todayAppointments.length === 0 ? (
              <p className="text-sm text-muted-foreground">No appointments scheduled today.</p>
            ) : (
              extras.todayAppointments.map((apt) => (
                <div
                  key={apt.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"
                >
                  <div>
                    <p className="font-medium">{apt.patientName}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(apt.startTime), "h:mm a")} — {apt.title}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      {statusLabel[apt.status] ?? apt.status}
                    </Badge>
                    {isFrontDeskView &&
                      ["SCHEDULED", "CONFIRMED"].includes(apt.status) && (
                        <Button size="sm" onClick={() => checkIn(apt.id)}>
                          Check in
                        </Button>
                      )}
                    {isClinicalView && (
                      <Button size="sm" variant="outline" asChild>
                        <Link
                          href={`/clinical?patientId=${apt.patientId}&appointmentId=${apt.id}`}
                        >
                          Open chart
                        </Link>
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
            {isClinicalView && (
              <div className="flex gap-2 pt-2">
                <Button asChild>
                  <Link href="/clinical">
                    <Stethoscope className="mr-2 h-4 w-4" />
                    Open chart
                  </Link>
                </Button>
                <Button variant="outline" asChild>
                  <Link href="/appointments">
                    <Calendar className="mr-2 h-4 w-4" />
                    View schedule
                  </Link>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isAdminView && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-dental" />
              <CardTitle>AI Insights</CardTitle>
              {plan === "STARTER" && <Badge variant="secondary">Upgrade for AI</Badge>}
            </div>
            <CardDescription>Automated analysis of your practice KPIs</CardDescription>
          </CardHeader>
          <CardContent>
            {plan === "STARTER" ? (
              <p className="text-sm text-muted-foreground">
                Upgrade to Professional or Enterprise to unlock AI-powered insights.
              </p>
            ) : aiLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
            ) : aiInsights ? (
              <div className="prose prose-sm dark:prose-invert whitespace-pre-wrap">
                {aiInsights}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Insights unavailable. Check OpenAI configuration.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {isFrontDeskView && !isAdminView && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Quick actions
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button asChild>
              <Link href="/appointments">Manage appointments</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/patients">Register patient</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/billing">View billing</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
