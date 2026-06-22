"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { AuditLog, StaffMember } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { Download } from "lucide-react";

type AuditWithUser = AuditLog & { user: StaffMember | null };

export function AuditLogSection({
  logs: initialLogs,
  totalCount,
  tenantId,
}: {
  logs: AuditWithUser[];
  totalCount: number;
  tenantId: string;
}) {
  const [logs] = useState(initialLogs);
  const [page, setPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(totalCount / 20));

  function exportCsv() {
    const rows = [
      ["Timestamp", "Action", "User", "Entity", "Entity ID", "Metadata"],
      ...logs.map((l) => [
        l.createdAt.toISOString(),
        l.action,
        l.user ? `${l.user.firstName ?? ""} ${l.user.lastName ?? l.user.email}`.trim() : "",
        l.entity,
        l.entityId ?? "",
        l.metadata ? JSON.stringify(l.metadata) : "",
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-log-${tenantId.slice(0, 8)}.csv`;
    a.click();
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          Audit log
          <Badge variant="outline">{totalCount}</Badge>
        </CardTitle>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="pb-2 pr-3">Time</th>
                <th className="pb-2 pr-3">Action</th>
                <th className="pb-2 pr-3">User</th>
                <th className="pb-2 pr-3">Entity</th>
                <th className="pb-2">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-border/50">
                  <td className="py-2 pr-3 whitespace-nowrap">{formatDate(log.createdAt)}</td>
                  <td className="py-2 pr-3">
                    <Badge variant="outline">{log.action}</Badge>
                  </td>
                  <td className="py-2 pr-3">
                    {log.user
                      ? `${log.user.firstName ?? ""} ${log.user.lastName ?? log.user.email}`.trim()
                      : "System"}
                  </td>
                  <td className="py-2 pr-3">
                    {log.entity}
                    {log.entityId && (
                      <span className="ml-1 text-muted-foreground">#{log.entityId.slice(0, 8)}</span>
                    )}
                  </td>
                  <td className="py-2 max-w-xs truncate text-muted-foreground">
                    {log.metadata ? JSON.stringify(log.metadata) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {logs.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">No audit events yet.</p>
          )}
        </div>
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
