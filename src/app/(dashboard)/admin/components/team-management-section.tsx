"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StaffMember } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";
import { Calendar, Eye, Pencil, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PersonAvatar } from "@/components/profile/person-avatar";
import {
  StaffMemberEditDialog,
  StaffMemberViewDialog,
} from "@/components/admin/staff-member-dialogs";
import { getRoleLabel } from "@/lib/rbac/permissions";
import {
  INVITABLE_ROLES,
  canEditInvitableStaffRole,
  normalizeToInvitableRole,
} from "@/lib/tenant/team-roles";
import {
  removeTeamMember,
  updateTeamMemberRole,
} from "@/app/(dashboard)/features/admin/actions";
import type { PendingInvitation } from "@/app/(dashboard)/features/admin/admin-types";
import type { z } from "zod";
import { updateTeamMemberRoleSchema } from "@/app/(dashboard)/features/admin/schemas";

type InvitableRole = z.infer<typeof updateTeamMemberRoleSchema>["role"];
import { InviteUserDialog } from "./invite-user-dialog";

type TeamManagementSectionProps = {
  users: StaffMember[];
  pendingInvitations: PendingInvitation[];
  currentUserId: string;
  canManage: boolean;
  uploadsEnabled: boolean;
  showUploadConfigHint?: boolean;
};

function roleBadgeVariant(role: UserRole): "default" | "secondary" | "outline" {
  switch (role) {
    case UserRole.ADMIN:
    case UserRole.OWNER:
      return "default";
    case UserRole.DOCTOR:
    case UserRole.DENTIST:
      return "secondary";
    default:
      return "outline";
  }
}

function initials(firstName?: string | null, lastName?: string | null, email?: string) {
  const a = firstName?.charAt(0) ?? "";
  const b = lastName?.charAt(0) ?? "";
  if (a || b) return `${a}${b}`.toUpperCase();
  return email?.charAt(0).toUpperCase() ?? "?";
}

function isClinicalStaffRole(role: UserRole): boolean {
  return (
    role === UserRole.DOCTOR ||
    role === UserRole.DENTIST ||
    role === UserRole.HYGIENIST
  );
}

export function TeamManagementSection({
  users,
  pendingInvitations,
  currentUserId,
  canManage,
  uploadsEnabled,
  showUploadConfigHint = false,
}: TeamManagementSectionProps) {
  const router = useRouter();
  const [removeTarget, setRemoveTarget] = useState<StaffMember | null>(null);
  const [busyUserId, setBusyUserId] = useState<string | null>(null);
  const [viewTarget, setViewTarget] = useState<StaffMember | null>(null);
  const [editTarget, setEditTarget] = useState<StaffMember | null>(null);

  async function handleRoleChange(userId: string, role: InvitableRole) {
    setBusyUserId(userId);
    const result = await updateTeamMemberRole({ userId, role });
    setBusyUserId(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Role updated");
  }

  async function confirmRemove() {
    if (!removeTarget) return;
    setBusyUserId(removeTarget.id);
    const result = await removeTeamMember({ userId: removeTarget.id });
    setBusyUserId(null);
    setRemoveTarget(null);

    if (!result.success) {
      toast.error(result.error);
      return;
    }
    toast.success("Team member removed");
  }

  const isAdminRole = (role: UserRole) => role === UserRole.ADMIN || role === UserRole.OWNER;

  function canEditMember(user: StaffMember) {
    if (!canManage || user.id === currentUserId || isAdminRole(user.role)) return false;
    return canEditInvitableStaffRole(user.role);
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Team management
            </CardTitle>
            <CardDescription>
              {users.length} member{users.length === 1 ? "" : "s"}
              {pendingInvitations.length > 0 &&
                ` · ${pendingInvitations.length} pending invitation${pendingInvitations.length === 1 ? "" : "s"}`}
            </CardDescription>
          </div>
          {canManage && <InviteUserDialog />}
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const isSelf = user.id === currentUserId;
                const canEditRow = canEditMember(user);
                const selectRole =
                  normalizeToInvitableRole(user.role) ?? UserRole.RECEPTIONIST;

                return (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <PersonAvatar
                          photoUrl={user.avatarUrl}
                          firstName={user.firstName}
                          lastName={user.lastName}
                          email={user.email}
                          size="sm"
                        />
                        <span className="font-medium">
                          {user.firstName || user.lastName
                            ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim()
                            : "Unnamed user"}
                          {isSelf && (
                            <span className="ml-1 text-xs text-muted-foreground">(you)</span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell>
                      {canEditRow ? (
                        <Select
                          value={selectRole}
                          disabled={busyUserId === user.id}
                          onValueChange={(v) => handleRoleChange(user.id, v as InvitableRole)}
                        >
                          <SelectTrigger className="h-8 w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {INVITABLE_ROLES.map((r) => (
                              <SelectItem key={r} value={r}>
                                {getRoleLabel(r)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant={roleBadgeVariant(user.role)}>{getRoleLabel(user.role)}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={user.isActive ? "secondary" : "outline"}>
                        {!user.authUserId && user.isActive
                          ? "Invited"
                          : user.isActive
                            ? "Active"
                            : "Suspended"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="View staff member"
                          onClick={() => setViewTarget(user)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        {canEditRow && (
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label="Edit staff member"
                            onClick={() => setEditTarget(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        {canManage && isClinicalStaffRole(user.role) && (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/staff/${user.id}/schedule`}>
                              <Calendar className="mr-1 h-3.5 w-3.5" />
                              Schedule
                            </Link>
                          </Button>
                        )}
                        {canManage && canEditRow ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={busyUserId === user.id}
                            onClick={() => setRemoveTarget(user)}
                          >
                            Remove
                          </Button>
                        ) : null}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
              {pendingInvitations.map((inv) => (
                <TableRow key={inv.id} className="bg-muted/30">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarFallback className="text-xs">
                          {inv.email.charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-muted-foreground italic">Invited user</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{inv.email}</TableCell>
                  <TableCell>
                    <Badge variant="outline">{getRoleLabel(inv.role)}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">Pending</Badge>
                  </TableCell>
                  <TableCell className="text-right text-xs text-muted-foreground">—</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {viewTarget && (
        <StaffMemberViewDialog
          user={viewTarget}
          open={!!viewTarget}
          onOpenChange={(open) => !open && setViewTarget(null)}
          canEdit={canEditMember(viewTarget)}
          onEdit={() => {
            setEditTarget(viewTarget);
            setViewTarget(null);
          }}
        />
      )}

      {editTarget && (
        <StaffMemberEditDialog
          user={editTarget}
          open={!!editTarget}
          onOpenChange={(open) => !open && setEditTarget(null)}
          uploadsEnabled={uploadsEnabled}
          showUploadConfigHint={showUploadConfigHint}
          onSaved={() => {
            setEditTarget(null);
            router.refresh();
          }}
        />
      )}

      <Dialog open={!!removeTarget} onOpenChange={(open) => !open && setRemoveTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove team member</DialogTitle>
            <DialogDescription>
              {removeTarget
                ? `Remove ${removeTarget.firstName ?? removeTarget.email} from your clinic? They will lose access immediately.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoveTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmRemove} disabled={!!busyUserId}>
              Remove user
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
