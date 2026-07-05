export const runtime = "nodejs";

import Link from "next/link";
import { requireTenantContext } from "@/lib/tenant/context";
import { redirectIfStaffMemberMissing } from "@/lib/rbac/staff-role";
import { getRoleLabel } from "@/lib/rbac/permissions";
import {
  getStaffMemberDisplayStatus,
  staffStatusBadgeVariant,
} from "@/lib/staff/staff-status";
import { personDisplayName } from "@/lib/utils/person-display";
import { PersonAvatar } from "@/components/profile/person-avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function field(label: string, value: string | null | undefined) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}

export default async function AccountPage() {
  const ctx = await requireTenantContext();
  redirectIfStaffMemberMissing(ctx);

  const member = ctx.staffMember!;
  const status = getStaffMemberDisplayStatus(member);
  const address = [member.addressLine1, member.city, member.country].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">My account</h1>
        <p className="text-sm text-muted-foreground">
          Your staff profile at {ctx.tenant.name}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-start gap-4">
            <PersonAvatar
              photoUrl={member.avatarUrl}
              firstName={member.firstName}
              lastName={member.lastName}
              email={member.email}
              size="lg"
            />
            <div className="space-y-2">
              <CardTitle>
                {personDisplayName(member.firstName, member.lastName, member.email)}
              </CardTitle>
              <CardDescription>{member.email}</CardDescription>
              <div className="flex flex-wrap gap-2">
                <Badge variant={staffStatusBadgeVariant(status)}>{status}</Badge>
                <Badge variant="outline">{getRoleLabel(member.role)}</Badge>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3">
            {member.staffRef ? (
              <div className="flex justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">Staff ID</dt>
                <dd className="font-mono text-xs">{member.staffRef}</dd>
              </div>
            ) : null}
            {field("Phone", member.phone)}
            {field("Emergency contact", member.emergencyContactName)}
            {field("Emergency phone", member.emergencyContactPhone)}
            {field("Address", address || null)}
            {field("License number", member.licenseNumber)}
          </dl>
        </CardContent>
      </Card>

      <Button variant="outline" asChild>
        <Link href="/dashboard">Back to dashboard</Link>
      </Button>
    </div>
  );
}
