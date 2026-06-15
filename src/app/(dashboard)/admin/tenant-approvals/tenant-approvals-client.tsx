"use client";

import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  approveTenantAction,
  rejectTenantAction,
} from "@/app/(dashboard)/features/tenant/actions";
import type { Prisma } from "@prisma/client";
import { formatDate } from "@/lib/utils";

type PendingRequest = Prisma.TenantApprovalRequestGetPayload<{
  include: { tenant: true };
}>;

export function TenantApprovalsClient({ pending }: { pending: PendingRequest[] }) {
  async function handleApprove(tenantId: string) {
    const result = await approveTenantAction({ tenantId });
    if (result.success) {
      toast.success("Tenant approved");
      window.location.reload();
    } else {
      toast.error(result.error);
    }
  }

  async function handleReject(tenantId: string) {
    const result = await rejectTenantAction({ tenantId, notes: "Rejected by super-admin" });
    if (result.success) {
      toast.success("Tenant rejected");
      window.location.reload();
    } else {
      toast.error(result.error);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Tenant approvals</h1>
        <p className="text-muted-foreground">Platform super-admin — pending clinic activations</p>
      </div>

      <div className="space-y-3">
        {pending.map((req) => (
          <Card key={req.id}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{req.tenant.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <div className="text-sm space-y-1">
                <p className="text-muted-foreground">Slug: {req.tenant.slug}</p>
                <p className="text-muted-foreground">
                  Requested: {formatDate(req.createdAt)}
                </p>
                <Badge variant="warning">{req.status}</Badge>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleApprove(req.tenantId)}>
                  Approve
                </Button>
                <Button size="sm" variant="destructive" onClick={() => handleReject(req.tenantId)}>
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        {pending.length === 0 && (
          <p className="text-center text-muted-foreground py-12">No pending approvals</p>
        )}
      </div>
    </div>
  );
}
