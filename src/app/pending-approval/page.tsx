import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getTenantContext } from "@/lib/tenant/context";
import { redirect } from "next/navigation";
import { TenantStatus } from "@prisma/client";

export default async function PendingApprovalPage() {
  const ctx = await getTenantContext();
  if (!ctx) redirect("/sign-in");
  if (ctx.tenant.status === TenantStatus.ACTIVE) redirect("/dashboard");
  if (ctx.isSuperAdmin) redirect("/super-admin");

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Clinic pending approval</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            Your clinic <strong>{ctx.tenant.name}</strong> is registered and awaiting platform
            approval.
          </p>
          <p>You will receive access once a DentaFlow administrator activates your tenant.</p>
          <p className="text-xs">Status: {ctx.tenant.status}</p>
        </CardContent>
      </Card>
    </div>
  );
}
