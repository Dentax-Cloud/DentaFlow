import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { InsuranceVerificationStatus } from "@/lib/insurance/policy-types";

const STATUS_CONFIG: Record<
  InsuranceVerificationStatus,
  { label: string; variant: "success" | "warning" | "destructive" | "secondary"; dotClass: string }
> = {
  VERIFIED: {
    label: "Verified",
    variant: "success",
    dotClass: "bg-emerald-500",
  },
  PENDING: {
    label: "Pending",
    variant: "warning",
    dotClass: "bg-amber-500",
  },
  NOT_VERIFIED: {
    label: "Not verified",
    variant: "destructive",
    dotClass: "bg-red-500",
  },
  EXPIRED: {
    label: "Expired",
    variant: "destructive",
    dotClass: "bg-red-500",
  },
};

type Props = {
  status?: InsuranceVerificationStatus | null;
  compact?: boolean;
  className?: string;
};

export function InsuranceStatusBadge({ status, compact = false, className }: Props) {
  if (!status) return null;
  const config = STATUS_CONFIG[status];

  if (compact) {
    return (
      <span
        className={cn("inline-block h-2 w-2 shrink-0 rounded-full", config.dotClass, className)}
        title={`Insurance: ${config.label}`}
        aria-label={`Insurance ${config.label}`}
      />
    );
  }

  return (
    <Badge variant={config.variant} className={className}>
      {config.label}
    </Badge>
  );
}

export function insuranceStatusLabel(status: InsuranceVerificationStatus) {
  return STATUS_CONFIG[status].label;
}
