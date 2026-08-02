"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { decideLeaveRequest } from "@/app/(dashboard)/features/hr/hr-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function HrLeaveQueueClient({
  canWrite,
  requests,
}: {
  canWrite: boolean;
  requests: Array<{
    id: string;
    employeeName: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    dayCount: number;
    reason: string | null;
  }>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  if (requests.length === 0) {
    return <p className="text-muted-foreground">No pending leave requests.</p>;
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <Card key={r.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <div className="text-sm">
              <p className="font-medium">{r.employeeName}</p>
              <p>
                {r.leaveTypeName}: {r.startDate} → {r.endDate} ({r.dayCount}d)
              </p>
              {r.reason && <p className="text-muted-foreground">{r.reason}</p>}
            </div>
            {canWrite && (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      try {
                        await decideLeaveRequest({ id: r.id, decision: "approved" });
                        toast.success("Approved");
                        router.refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    })
                  }
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={() =>
                    start(async () => {
                      try {
                        await decideLeaveRequest({ id: r.id, decision: "rejected" });
                        toast.success("Rejected");
                        router.refresh();
                      } catch (e) {
                        toast.error(e instanceof Error ? e.message : "Failed");
                      }
                    })
                  }
                >
                  Reject
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
