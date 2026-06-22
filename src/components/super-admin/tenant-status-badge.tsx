import { TenantStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const tenantStatusVariant: Record<
  TenantStatus,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  ACTIVE: "success",
  SUSPENDED: "destructive",
  PENDING: "warning",
  CLOSED: "secondary",
};

export function TenantStatusBadge({ status }: { status: TenantStatus }) {
  return (
    <Badge variant={tenantStatusVariant[status] ?? "secondary"}>
      {status}
    </Badge>
  );
}
