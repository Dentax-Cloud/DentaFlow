"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing-client";
import {
  approveTimeEntry,
  createManualTimeEntry,
  registerEmployeeDocument,
  submitLeaveRequest,
  updateEmployee,
} from "@/app/(dashboard)/features/hr/hr-actions";
import type { LeaveBalance } from "@/lib/hr/leave";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function HrEmployeeDetailClient({
  employeeId,
  canWrite,
  leaveTypes,
  balances,
  timeEntries,
  leaveRequests,
}: {
  employeeId: string;
  canWrite: boolean;
  leaveTypes: { id: string; name: string }[];
  balances: LeaveBalance[];
  timeEntries: Array<{
    id: string;
    clockInAt: string;
    clockOutAt: string | null;
    source: string;
    status: string;
    breakMinutes: number;
  }>;
  leaveRequests: Array<{
    id: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    dayCount: number;
    status: string;
  }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [staffMemberId, setStaffMemberId] = useState("");
  const { startUpload, isUploading } = useUploadThing("employeeDocument", {
    onUploadError: (e) => {
      toast.error(e.message);
    },
  });

  async function onUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const title = prompt("Document title", file.name) ?? file.name;
    const docType =
      prompt("Type: contract | id | credential | policy_ack | other", "credential") ??
      "other";
    const expires =
      docType === "credential" || docType === "id"
        ? prompt("Expiry date (YYYY-MM-DD, optional)", "")
        : "";
    try {
      const uploaded = await startUpload([file], { employeeId });
      const first = uploaded?.[0] as
        | { url?: string; ufsUrl?: string; serverData?: { url?: string }; name?: string }
        | undefined;
      const url = first?.serverData?.url ?? first?.ufsUrl ?? first?.url;
      if (!url) {
        toast.error("Upload failed");
        return;
      }
      await registerEmployeeDocument({
        employeeId,
        documentType: docType,
        title,
        fileUrl: url,
        fileName: first?.name ?? file.name,
        mimeType: file.type,
        expiresAt: expires || null,
      });
      toast.success("Document saved");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    }
  }

  return (
    <div className="space-y-4">
      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Link login account</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <Label htmlFor="staffMemberId">StaffMember id</Label>
              <Input
                id="staffMemberId"
                value={staffMemberId}
                onChange={(e) => setStaffMemberId(e.target.value)}
                placeholder="Paste StaffMember id for self-service"
              />
            </div>
            <Button
              type="button"
              disabled={pending || !staffMemberId.trim()}
              onClick={() =>
                start(async () => {
                  try {
                    await updateEmployee({
                      id: employeeId,
                      staffMemberId: staffMemberId.trim(),
                    });
                    toast.success("Linked");
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Link failed");
                  }
                })
              }
            >
              Link
            </Button>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload document</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            accept="image/*,application/pdf"
            disabled={isUploading}
            onChange={onUpload}
          />
          <p className="mt-1 text-xs text-muted-foreground">PDF or image, max 16MB / 8MB.</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave balances (this year)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {balances.map((b) => (
            <div key={b.leaveTypeId} className="flex flex-wrap gap-3">
              <span className="font-medium">{b.name}</span>
              <span>
                remaining {b.remaining} / {b.entitlement}
              </span>
              <span className="text-muted-foreground">
                used {b.usedApproved} · pending {b.pending}
              </span>
            </div>
          ))}
          {balances.length === 0 && (
            <p className="text-muted-foreground">No leave types configured.</p>
          )}
        </CardContent>
      </Card>

      {canWrite && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Manual time entry</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-2 sm:grid-cols-3"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                start(async () => {
                  try {
                    await createManualTimeEntry({
                      employeeId,
                      clockInAt: String(fd.get("clockInAt")),
                      clockOutAt: String(fd.get("clockOutAt") || "") || null,
                      breakMinutes: Number(fd.get("breakMinutes") || 0),
                    });
                    toast.success("Time entry created");
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                });
              }}
            >
              <div>
                <Label>Clock in</Label>
                <Input name="clockInAt" type="datetime-local" required />
              </div>
              <div>
                <Label>Clock out</Label>
                <Input name="clockOutAt" type="datetime-local" />
              </div>
              <div>
                <Label>Break (min)</Label>
                <Input name="breakMinutes" type="number" defaultValue={0} />
              </div>
              <Button type="submit" disabled={pending}>
                Add
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Time entries</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {timeEntries.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{t.status}</Badge>
              <span>
                {t.clockInAt.slice(0, 16)} → {t.clockOutAt?.slice(0, 16) ?? "open"}
              </span>
              <span className="text-muted-foreground">{t.source}</span>
              {canWrite && t.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      try {
                        await approveTimeEntry(t.id);
                        toast.success("Approved");
                        router.refresh();
                      } catch (err) {
                        toast.error(err instanceof Error ? err.message : "Failed");
                      }
                    })
                  }
                >
                  Approve
                </Button>
              )}
            </div>
          ))}
          {timeEntries.length === 0 && (
            <p className="text-muted-foreground">No time entries.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave history</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {leaveRequests.map((r) => (
            <div key={r.id} className="flex flex-wrap gap-2">
              <Badge variant="outline">{r.status}</Badge>
              <span>
                {r.leaveTypeName}: {r.startDate} → {r.endDate} ({r.dayCount}d)
              </span>
            </div>
          ))}
          {leaveRequests.length === 0 && (
            <p className="text-muted-foreground">No leave requests.</p>
          )}
        </CardContent>
      </Card>

      {canWrite && leaveTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Submit leave (HR)</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              className="grid gap-2 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                start(async () => {
                  try {
                    await submitLeaveRequest({
                      employeeId,
                      leaveTypeId: String(fd.get("leaveTypeId")),
                      startDate: String(fd.get("startDate")),
                      endDate: String(fd.get("endDate")),
                      reason: String(fd.get("reason") || "") || undefined,
                    });
                    toast.success("Leave submitted");
                    router.refresh();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed");
                  }
                });
              }}
            >
              <div>
                <Label>Type</Label>
                <select
                  name="leaveTypeId"
                  className="flex h-9 w-full rounded-md border px-2 text-sm"
                  required
                >
                  {leaveTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label>Reason</Label>
                <Input name="reason" />
              </div>
              <div>
                <Label>Start</Label>
                <Input name="startDate" type="date" required />
              </div>
              <div>
                <Label>End</Label>
                <Input name="endDate" type="date" required />
              </div>
              <Button type="submit" disabled={pending}>
                Submit
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
