"use client";



import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";

import type { Branch, StaffMember, AuditLog, Settings } from "@prisma/client";

import type { PermissionKey } from "@/lib/rbac/permissions";

import { hasPermission, PERMISSIONS } from "@/lib/rbac/permissions";

import { UserRole } from "@prisma/client";

import { formatDate } from "@/lib/utils";

import Link from "next/link";

import { Shield, Upload, Building2 } from "lucide-react";

import { Button } from "@/components/ui/button";

import { TeamManagementSection } from "./components/team-management-section";

import {
  ClinicSettingsForm,
  type TenantTaxDisplay,
} from "./components/clinic-settings-form";

import { RecallSettingsSection } from "./components/recall-settings-section";
import { AuditLogSection } from "./components/audit-log-section";
import { BranchesSection } from "./components/branches-section";
import type { PendingInvitation } from "@/app/(dashboard)/features/admin/admin-types";
import type { RecallSettings } from "@/lib/recall/helpers";



type AuditWithUser = AuditLog & { user: StaffMember | null };



type BranchRow = Branch & {
  _count: { chairs: number; appointments: number };
  staffCount: number;
};

export function AdminClient({

  users,

  auditLogs,

  auditLogTotal,

  branches,

  settings,

  tenantTax,

  pendingInvitations,

  currentUserRole,

  currentUserId,

  permissions,

  recallSettings,

  tenantId,

  staffIdsWithoutSchedule,

  uploadsEnabled,

  showUploadConfigHint,

}: {

  users: StaffMember[];

  auditLogs: AuditWithUser[];

  auditLogTotal: number;

  branches: BranchRow[];

  settings: Settings | null;

  tenantTax: TenantTaxDisplay;

  pendingInvitations: PendingInvitation[];

  currentUserRole: UserRole;

  currentUserId: string;

  permissions: PermissionKey[];

  recallSettings: RecallSettings;

  tenantId: string;

  staffIdsWithoutSchedule: string[];

  uploadsEnabled: boolean;

  showUploadConfigHint: boolean;

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

        staffIdsWithoutSchedule={staffIdsWithoutSchedule}

        uploadsEnabled={uploadsEnabled}

        showUploadConfigHint={showUploadConfigHint}

      />



      <ClinicSettingsForm
        settings={settings}
        tenantTax={tenantTax}
        canEdit={canEditSettings}
      />



      <RecallSettingsSection settings={recallSettings} canEdit={canEditSettings} />

      <BranchesSection branches={branches} canEdit={canEditSettings} />

      <AuditLogSection logs={auditLogs} totalCount={auditLogTotal} tenantId={tenantId} />

    </div>

  );

}

