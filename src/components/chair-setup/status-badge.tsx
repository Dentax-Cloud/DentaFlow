import type { ChairDisplayStatus } from "@/lib/chair-setup/types";
import { STATUS_CONFIG } from "@/lib/chair-setup/constants";
import { cn } from "@/lib/utils";

export function StatusBadge({ status }: { status: ChairDisplayStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        config.bg,
      )}
    >
      <span>{config.dot}</span>
      {config.label}
    </span>
  );
}
