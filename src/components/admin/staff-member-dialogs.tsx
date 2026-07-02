"use client";

import { useEffect, useState } from "react";
import type { StaffMember } from "@prisma/client";
import { UserRole } from "@prisma/client";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { personDisplayName } from "@/lib/utils/person-display";
import { getRoleLabel } from "@/lib/rbac/permissions";
import { INVITABLE_ROLES, isInvitableRole } from "@/lib/tenant/team-roles";
import { updateStaffMemberProfile } from "@/app/(dashboard)/features/admin/actions";
import { PersonAvatar } from "@/components/profile/person-avatar";
import { PhotoCapture } from "@/components/profile/photo-capture";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type StaffStatus = "INVITED" | "ACTIVE" | "SUSPENDED";

function resolveStaffStatus(user: StaffMember): StaffStatus {
  if (!user.isActive) return "SUSPENDED";
  if (!user.authUserId) return "INVITED";
  return "ACTIVE";
}

function isEditableStaffRole(role: UserRole): boolean {
  return (
    role !== UserRole.OWNER &&
    role !== UserRole.ADMIN &&
    role !== UserRole.STAFF &&
    role !== UserRole.STORE &&
    role !== UserRole.NURSE &&
    role !== UserRole.FINANCE &&
    role !== UserRole.MANAGER
  );
}

function statusBadgeVariant(status: StaffStatus): "default" | "secondary" | "outline" {
  switch (status) {
    case "ACTIVE":
      return "default";
    case "INVITED":
      return "secondary";
    default:
      return "outline";
  }
}

type ViewProps = {
  user: StaffMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit?: () => void;
  canEdit: boolean;
};

export function StaffMemberViewDialog({ user, open, onOpenChange, onEdit, canEdit }: ViewProps) {
  const status = resolveStaffStatus(user);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Staff member</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-4">
          <PersonAvatar
            photoUrl={user.avatarUrl}
            firstName={user.firstName}
            lastName={user.lastName}
            email={user.email}
            size="lg"
          />
          <div>
            <p className="font-semibold">
              {personDisplayName(user.firstName, user.lastName, user.email)}
            </p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant={statusBadgeVariant(status)}>{status}</Badge>
              <Badge variant="outline">{getRoleLabel(user.role)}</Badge>
            </div>
          </div>
        </div>
        <dl className="grid gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Joined</dt>
            <dd>{formatDate(user.createdAt)}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Account</dt>
            <dd>{user.authUserId ? "Accepted invite" : "Pending invite"}</dd>
          </div>
        </dl>
        <DialogFooter>
          {canEdit && onEdit ? (
            <Button type="button" onClick={onEdit}>
              Edit
            </Button>
          ) : null}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type EditProps = {
  user: StaffMember;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  uploadsEnabled: boolean;
  showUploadConfigHint?: boolean;
  onSaved?: () => void;
};

export function StaffMemberEditDialog({
  user,
  open,
  onOpenChange,
  uploadsEnabled,
  showUploadConfigHint = false,
  onSaved,
}: EditProps) {
  const [firstName, setFirstName] = useState(user.firstName ?? "");
  const [lastName, setLastName] = useState(user.lastName ?? "");
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>(() => {
    if (user.role === UserRole.DOCTOR || user.role === UserRole.DENTIST) return UserRole.DENTIST;
    if (isInvitableRole(user.role)) return user.role;
    return UserRole.RECEPTIONIST;
  });
  const [isActive, setIsActive] = useState(user.isActive);
  const [busy, setBusy] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl);

  useEffect(() => {
    setFirstName(user.firstName ?? "");
    setLastName(user.lastName ?? "");
    setRole(
      user.role === UserRole.DOCTOR || user.role === UserRole.DENTIST
        ? UserRole.DENTIST
        : isInvitableRole(user.role)
          ? user.role
          : UserRole.RECEPTIONIST,
    );
    setIsActive(user.isActive);
    setAvatarUrl(user.avatarUrl);
  }, [user]);

  const canEditRole = isEditableStaffRole(user.role);

  async function handleSave() {
    setBusy(true);
    const result = await updateStaffMemberProfile({
      userId: user.id,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      ...(canEditRole ? { role } : {}),
      isActive,
    });
    setBusy(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("Staff member updated");
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit staff member</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <PhotoCapture
            entityType="staff"
            entityId={user.id}
            currentPhotoUrl={avatarUrl}
            firstName={firstName}
            lastName={lastName}
            email={user.email}
            uploadsEnabled={uploadsEnabled}
            showAdminConfigHint={showUploadConfigHint}
            onPhotoUpdated={setAvatarUrl}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="staff-first-name">First name</Label>
              <Input
                id="staff-first-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="staff-last-name">Last name</Label>
              <Input
                id="staff-last-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={user.email} disabled />
          </div>

          {canEditRole ? (
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as (typeof INVITABLE_ROLES)[number])}
              >
                <SelectTrigger>
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
            </div>
          ) : (
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={getRoleLabel(user.role)} disabled />
            </div>
          )}

          <div className="space-y-2">
            <Label>Status</Label>
            <Select
              value={isActive ? "ACTIVE" : "SUSPENDED"}
              onValueChange={(v) => setIsActive(v === "ACTIVE")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="SUSPENDED">Suspended</SelectItem>
              </SelectContent>
            </Select>
            {!user.authUserId && (
              <p className="text-xs text-muted-foreground">
                This member has not accepted their invite yet (INVITED).
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={busy}>
            {busy ? "Saving..." : "Save changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
