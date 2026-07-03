import type { PreAuthStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const STATUS_CONFIG: Record<
  PreAuthStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary" | "outline" }
> = {
  DRAFT: { label: "Pre-auth: Draft", variant: "secondary" },
  SUBMITTED: { label: "Pre-auth: Submitted", variant: "warning" },
  APPROVED: { label: "Pre-auth: Approved", variant: "success" },
  PARTIALLY_APPROVED: { label: "Pre-auth: Partial", variant: "warning" },
  DENIED: { label: "Pre-auth: Denied", variant: "destructive" },
  EXPIRED: { label: "Pre-auth: Expired", variant: "destructive" },
};

type Props = {
  status?: PreAuthStatus | null;
  compact?: boolean;
  className?: string;
};

export function PreAuthStatusBadge({ status, compact = false, className }: Props) {
  if (!status) return null;
  const config = STATUS_CONFIG[status];

  if (compact) {
    return (
      <Badge variant={config.variant} className={cn("text-xs", className)}>
        {config.label.replace("Pre-auth: ", "")}
      </Badge>
    );
  }

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}
