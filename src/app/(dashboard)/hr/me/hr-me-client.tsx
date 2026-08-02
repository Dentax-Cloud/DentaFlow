"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useUploadThing } from "@/lib/uploadthing-client";
import {
  clockIn,
  clockOut,
  createManualTimeEntry,
  registerEmployeeDocument,
  submitLeaveRequest,
} from "@/app/(dashboard)/features/hr/hr-actions";
import type { LeaveBalance } from "@/lib/hr/leave";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export function HrMeClient({
  employeeId,
  leaveTypes,
  balances,
  timeEntries,
  leaveRequests,
}: {
  employeeId: string;
  leaveTypes: { id: string; name: string }[];
  balances: LeaveBalance[];
  timeEntries: Array<{
    id: string;
    clockInAt: string;
    clockOutAt: string | null;
    status: string;
    source: string;
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
  const { startUpload, isUploading } = useUploadThing("employeeDocument");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Time clock</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  await clockIn();
                  toast.success("Clocked in");
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              })
            }
          >
            Clock in
          </Button>
          <Button
            variant="outline"
            disabled={pending}
            onClick={() =>
              start(async () => {
                try {
                  await clockOut();
                  toast.success("Clocked out");
                  router.refresh();
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed");
                }
              })
            }
          >
            Clock out
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual time entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="grid gap-2 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => {
                try {
                  await createManualTimeEntry({
                    employeeId,
                    clockInAt: String(fd.get("clockInAt")),
                    clockOutAt: String(fd.get("clockOutAt") || "") || null,
                  });
                  toast.success("Saved");
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
            <Button type="submit" disabled={pending}>
              Add
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent time</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {timeEntries.map((t) => (
            <div key={t.id}>
              <Badge variant="outline">{t.status}</Badge>{" "}
              {t.clockInAt.slice(0, 16)} → {t.clockOutAt?.slice(0, 16) ?? "open"} ({t.source})
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Leave balances</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {balances.map((b) => (
            <div key={b.leaveTypeId}>
              {b.name}: remaining {b.remaining}/{b.entitlement} (used {b.usedApproved}, pending{" "}
              {b.pending})
            </div>
          ))}
        </CardContent>
      </Card>

      {leaveTypes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Request leave</CardTitle>
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
                      leaveTypeId: String(fd.get("leaveTypeId")),
                      startDate: String(fd.get("startDate")),
                      endDate: String(fd.get("endDate")),
                      reason: String(fd.get("reason") || "") || undefined,
                    });
                    toast.success("Leave requested");
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">My leave requests</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          {leaveRequests.map((r) => (
            <div key={r.id}>
              <Badge variant="outline">{r.status}</Badge> {r.leaveTypeName}: {r.startDate} →{" "}
              {r.endDate} ({r.dayCount}d)
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload my document</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            type="file"
            accept="image/*,application/pdf"
            disabled={isUploading}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                const uploaded = await startUpload([file], { employeeId });
                const first = uploaded?.[0] as
                  | { url?: string; ufsUrl?: string; serverData?: { url?: string } }
                  | undefined;
                const url = first?.serverData?.url ?? first?.ufsUrl ?? first?.url;
                if (!url) throw new Error("Upload failed");
                await registerEmployeeDocument({
                  employeeId,
                  documentType: "other",
                  title: file.name,
                  fileUrl: url,
                  fileName: file.name,
                  mimeType: file.type,
                });
                toast.success("Uploaded");
                router.refresh();
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "Failed");
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
