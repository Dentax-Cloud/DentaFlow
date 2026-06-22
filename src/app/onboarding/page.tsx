export const runtime = "nodejs";

import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { getTenantContext } from "@/lib/tenant/context";
import { OnboardingClient } from "./onboarding-client";
import { SubscriptionPlan } from "@/lib/subscription/plan-types";
import { db } from "@/lib/db";

export default async function OnboardingPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");
  if (session.user.activeTenantId) redirect("/dashboard");

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  const chairCount = await db.chair.count({ where: { tenantId: ctx.tenant.id } });

  const initial = {
    clinicName: ctx.tenant.name ?? "",
    email: ctx.tenant.email ?? ctx.staffMember?.email ?? "",
    phone: ctx.tenant.phone ?? "",
    address: ctx.tenant.address ?? "",
    city: ctx.tenant.city ?? "",
    country: ctx.tenant.country ?? "AE",
    timezone: ctx.tenant.timezone ?? "Asia/Dubai",
    chairCount: chairCount > 0 ? chairCount : 4,
    plan: ctx.tenant.subscriptionPlan ?? SubscriptionPlan.STARTER,
    trialDaysRemaining: ctx.trial.trialDaysRemaining ?? null,
  };

  return <OnboardingClient initial={initial} />;
}
