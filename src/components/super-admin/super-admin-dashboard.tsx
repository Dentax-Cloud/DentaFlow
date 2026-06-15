"use client";

import Link from "next/link";
import { Shield, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TenantAnalyticsSummary } from "./tenant-analytics-summary";
import { TenantList } from "./tenant-list";
import type { PlatformAnalytics, TenantListItem } from "@/lib/super-admin/queries";

type Props = {
  analytics: PlatformAnalytics;
  tenants: TenantListItem[];
  pendingCount: number;
};

export function SuperAdminDashboard({ analytics, tenants, pendingCount }: Props) {
  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950 p-8 text-white shadow-xl">
        <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-dental/20 blur-3xl" />
        <div className="absolute -bottom-12 -left-8 h-40 w-40 rounded-full bg-violet-500/20 blur-3xl" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-sky-300" />
              <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">
                Platform Control
              </Badge>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Super Admin Dashboard</h1>
            <p className="max-w-xl text-sm text-slate-300">
              Monitor all dental clinic tenants, manage lifecycle, and maintain strong tenant
              isolation across the DentaFlow platform.
            </p>
          </div>
          {pendingCount > 0 && (
            <Card className="border-amber-500/30 bg-amber-500/10 text-white shadow-none">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-amber-100">
                  {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}
                </CardTitle>
                <CardDescription className="text-amber-200/80">
                  New clinics awaiting activation
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Button asChild variant="secondary" size="sm">
                  <Link href="/admin/tenant-approvals">
                    Review approvals
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <TenantAnalyticsSummary analytics={analytics} />

      <div className="space-y-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">All Tenants</h2>
          <p className="text-sm text-muted-foreground">
            View, suspend, activate, impersonate, or archive clinic organizations.
          </p>
        </div>
        <TenantList tenants={tenants} />
      </div>
    </div>
  );
}
