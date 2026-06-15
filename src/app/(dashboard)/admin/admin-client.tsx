"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { User, AuditLog, Settings } from "@prisma/client";
import type { PermissionKey } from "@/lib/rbac/permissions";
import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";
import { UserRole } from "@prisma/client";
import { formatDate } from "@/lib/utils";
import Link from "next/link";
import { Shield, ScrollText, Upload, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TeamManagementSection } from "./components/team-management-section";
import { ClinicSettingsForm } from "./components/clinic-settings-form";
import type { PendingInvitation } from "@/app/(dashboard)/features/admin/actions";

type AuditWithUser = AuditLog & { user: User | null };

export function AdminClient({
  users,
  auditLogs,
  settings,
  pendingInvitations,
  currentUserRole,
  currentUserId,
  permissions,
}: {
  users: User[];
  auditLogs: AuditWithUser[];
  settings: Settings | null;
  pendingInvitations: PendingInvitation[];
  currentUserRole: UserRole;
  currentUserId: string;
  permissions: PermissionKey[];
}) {
  const canManageTeam = hasPermission(currentUserRole, PERMISSIONS.admin.users);
  const canEditSettings = hasPermission(currentUserRole, PERMISSIONS.admin.write);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground">Manage your team, clinic settings, and audit trail</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/admin/clinic-profile">
              <Building2 className="mr-2 h-4 w-4" />
              Clinic profile
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/admin/data-import">
              <Upload className="mr-2 h-4 w-4" />
              Data import
            </Link>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Your permissions ({currentUserRole})
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-1">
          {permissions.map((p) => (
            <Badge key={p} variant="outline" className="text-xs">
              {p}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <TeamManagementSection
        users={users}
        pendingInvitations={pendingInvitations}
        currentUserId={currentUserId}
        canManage={canManageTeam}
      />

      <ClinicSettingsForm settings={settings} canEdit={canEditSettings} />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ScrollText className="h-4 w-4" />
            Audit log
          </CardTitle>
        </CardHeader>
        <CardContent className="max-h-96 space-y-2 overflow-y-auto">
          {auditLogs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit events yet.</p>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="flex justify-between border-b pb-2 text-xs">
                <span>
                  {log.action} {log.entity}
                  {log.user && ` by ${log.user.firstName ?? log.user.email}`}
                </span>
                <span className="text-muted-foreground">{formatDate(log.createdAt)}</span>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
