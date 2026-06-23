import { redirect } from "next/navigation";
import { getServerAuthSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { TenantStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default async function PendingApprovalPage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const tenant = session.user.activeTenantId
    ? await db.tenant.findUnique({ where: { id: session.user.activeTenantId } })
    : null;

  if (!tenant) redirect("/dashboard");
  if (tenant.status === TenantStatus.ACTIVE) redirect("/dashboard");
  if (session.user.isSuperAdmin) redirect("/superadmin/tenants");

  const isSuspended = tenant.status === TenantStatus.SUSPENDED;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>
            {isSuspended ? "Account suspended" : "Account unavailable"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Your DentaFlow account for <strong>{tenant.name}</strong> is currently{" "}
            {isSuspended ? "suspended" : "unavailable"}.
          </p>
          {tenant.suspendedReason && (
            <p>
              <strong>Reason:</strong> {tenant.suspendedReason}
            </p>
          )}
          <p>
            Please contact support to restore access to your clinic data and team workspace.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Button asChild variant="outline">
              <a href="mailto:support@dentaflow.io">Contact support</a>
            </Button>
            <Button asChild>
              <a href="/login">Back to login</a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
