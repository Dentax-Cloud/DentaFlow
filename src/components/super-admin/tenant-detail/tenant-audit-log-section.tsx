import Link from "next/link";
import { formatDate } from "@/lib/utils";
import type { AuditLog, StaffMember } from "@prisma/client";
import { Button } from "@/components/ui/button";

type AuditRow = AuditLog & { user: StaffMember | null };

type Props = {
  tenantId: string;
  logs: AuditRow[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
};

export function TenantAuditLogSection({
  tenantId,
  logs,
  totalCount,
  currentPage,
  pageSize,
}: Props) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const baseHref = `/superadmin/tenants/${tenantId}`;

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-400">
        {totalCount} event{totalCount === 1 ? "" : "s"} total · page {currentPage} of{" "}
        {totalPages}
      </p>

      {logs.length === 0 ? (
        <p className="text-sm text-zinc-500">No audit events yet.</p>
      ) : (
        <div className="divide-y divide-white/10 rounded-lg border border-white/10">
          {logs.map((log) => (
            <div
              key={log.id}
              className="flex flex-wrap items-start justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <span className="font-medium">{log.action}</span>{" "}
                <span className="text-zinc-400">{log.entity}</span>
                {log.user && (
                  <span className="text-zinc-500">
                    {" "}
                    · {log.user.firstName ?? ""} {log.user.lastName ?? log.user.email}
                  </span>
                )}
                {log.metadata && typeof log.metadata === "object" && (
                  <p className="mt-1 text-xs text-zinc-500">
                    {JSON.stringify(log.metadata)}
                  </p>
                )}
              </div>
              <span className="shrink-0 text-zinc-500">{formatDate(log.createdAt)}</span>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center gap-2">
          {currentPage > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`${baseHref}?auditPage=${currentPage - 1}`}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          {currentPage < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`${baseHref}?auditPage=${currentPage + 1}`}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
