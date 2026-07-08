import { Suspense } from "react";
import { requireRouteAccess } from "@/lib/rbac/require-route-access";
import {
  getClaims,
  getClaimableInvoices,
} from "@/app/(dashboard)/features/insurance/claim-actions";
import { ClaimsClient } from "./claims-client";

export default async function ClaimsPage() {
  const ctx = await requireRouteAccess("billing", "read");
  const [claims, claimableInvoices] = await Promise.all([
    getClaims(ctx.tenant.id),
    getClaimableInvoices(ctx.tenant.id),
  ]);

  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading claims…</div>}>
      <ClaimsClient claims={claims} claimableInvoices={claimableInvoices} />
    </Suspense>
  );
}
