export const runtime = "nodejs";

import Link from "next/link";
import { getServerAuthSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTenantContext } from "@/lib/tenant/context";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AccountSetupIncompletePage() {
  const session = await getServerAuthSession();
  if (!session?.user?.id) redirect("/login");

  const ctx = await getTenantContext();
  if (!ctx) redirect("/select-org");

  if (ctx.staffMember) {
    redirect("/dashboard");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Account setup incomplete</CardTitle>
          <CardDescription>
            Your sign-in is linked to {ctx.tenant.name}, but your staff profile is not set up yet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm text-muted-foreground">
          <p>
            Your account setup is incomplete. Contact your clinic administrator to finish
            provisioning your staff profile, or ask them to resend your team invitation.
          </p>
          <p className="text-xs">Signed in as {session.user.email}</p>
          <Button asChild variant="outline">
            <Link href="/select-org">Switch clinic</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
