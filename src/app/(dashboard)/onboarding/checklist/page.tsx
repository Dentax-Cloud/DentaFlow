import Link from "next/link";
import { redirect } from "next/navigation";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import { getOnboardingChecklist } from "@/lib/tenant/onboarding";
import { OnboardingChecklist } from "@/components/dashboard/onboarding-checklist";
import { Button } from "@/components/ui/button";

export default async function OnboardingChecklistPage() {
  const ctx = await requireRouteAccess("admin", "read");

  const checklist = await getOnboardingChecklist(ctx.tenant);
  if (!checklist.showChecklist) redirect("/dashboard");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Getting started</h1>
          <p className="text-muted-foreground">
            Complete these steps to set up {ctx.tenant.name}.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
      <OnboardingChecklist items={checklist.items} />
    </div>
  );
}
