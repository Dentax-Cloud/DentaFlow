import { SubscriptionStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";

const variant: Record<
  SubscriptionStatus,
  "default" | "secondary" | "success" | "warning" | "destructive"
> = {
  TRIALING: "default",
  ACTIVE: "success",
  PAST_DUE: "warning",
  CANCELED: "secondary",
  PAUSED: "warning",
  EXPIRED: "destructive",
};

export function SubscriptionStatusBadge({ status }: { status: SubscriptionStatus }) {
  return (
    <Badge variant={variant[status] ?? "secondary"}>
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
