"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Search } from "lucide-react";
import type { SubscriptionPlan, SubscriptionStatus, TenantStatus } from "@prisma/client";

type ClinicOption = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  subscriptionPlan: SubscriptionPlan;
  subscriptionStatus: SubscriptionStatus;
  status: TenantStatus;
  role: string;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function SelectOrgClient({ clinics }: { clinics: ClinicOption[] }) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clinics;
    return clinics.filter((c) => c.name.toLowerCase().includes(q));
  }, [clinics, query]);

  return (
    <div className="w-full max-w-2xl space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-white">Choose a clinic</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Switch between clinics you belong to, or register a new one.
        </p>
      </div>

      {clinics.length > 3 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search clinics..."
            className="h-11 border-white/10 bg-zinc-900 pl-10 text-white"
          />
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {filtered.map((clinic) => (
          <Card key={clinic.id} className="border-white/10 bg-zinc-900/80">
            <CardContent className="flex h-full flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl bg-sky-500/15 text-sm font-semibold text-sky-300">
                  {clinic.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={clinic.logoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    initials(clinic.name)
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-white">{clinic.name}</p>
                  <p className="text-xs text-zinc-500">{clinic.role}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline" className="border-white/10 text-zinc-300">
                      {clinic.subscriptionPlan}
                    </Badge>
                    <Badge
                      variant={clinic.status === "ACTIVE" ? "default" : "destructive"}
                      className="capitalize"
                    >
                      {clinic.status.toLowerCase()}
                    </Badge>
                  </div>
                </div>
              </div>
              <Button asChild className="mt-auto w-full">
                <Link href={`/api/user/tenants?switchTo=${clinic.id}`}>Switch to this clinic</Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="text-center text-sm text-zinc-500">No clinics match your search.</p>
      )}

      <Card className="border-dashed border-white/10 bg-zinc-950/40">
        <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
          <Building2 className="h-8 w-8 text-sky-400" />
          <div>
            <p className="font-medium text-white">Register another clinic</p>
            <p className="text-sm text-zinc-400">Start a new 14-day trial for another location.</p>
          </div>
          <Button asChild variant="outline" className="border-white/15">
            <Link href="/sign-up">Register new clinic</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
