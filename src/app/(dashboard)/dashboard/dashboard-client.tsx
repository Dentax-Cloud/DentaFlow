"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";
import { Calendar, Armchair, DollarSign, FileText, Users, Sparkles } from "lucide-react";
import type { SubscriptionPlan } from "@/lib/subscription/plan-types";

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

export function DashboardClient({
  kpis,
  tenantName,
  plan,
}: {
  kpis: KPIs;
  tenantName: string;
  plan: SubscriptionPlan;
}) {
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
    enabled: plan !== "STARTER",
    staleTime: 300_000,
  });

  const cards = [
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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {cards.map((card) => (
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
            <div className="prose prose-sm dark:prose-invert whitespace-pre-wrap">{aiInsights}</div>
          ) : (
            <p className="text-sm text-muted-foreground">Insights unavailable. Check OpenAI configuration.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
