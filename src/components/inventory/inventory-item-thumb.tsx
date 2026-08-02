import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

type Size = "sm" | "md" | "lg";

const SIZE_CLS: Record<Size, string> = {
  sm: "h-8 w-8",
  md: "h-12 w-12",
  lg: "h-24 w-24",
};

const ICON_CLS: Record<Size, string> = {
  sm: "h-4 w-4",
  md: "h-5 w-5",
  lg: "h-8 w-8",
};

/**
 * Compact product thumbnail or package placeholder when imageUrl is null.
 * Pure presentational — safe for list/table/detail without client hooks.
 */
export function InventoryItemThumb({
  imageUrl,
  name,
  size = "md",
  className,
}: {
  imageUrl?: string | null;
  name: string;
  size?: Size;
  className?: string;
}) {
  const box = cn(
    "relative flex shrink-0 items-center justify-center overflow-hidden rounded-md border bg-muted/40 text-muted-foreground",
    SIZE_CLS[size],
    className,
  );

  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- UploadThing absolute URLs; avoid remotePatterns churn
      <img
        src={imageUrl}
        alt={name}
        className={cn(box, "object-cover")}
      />
    );
  }

  return (
    <div className={box} aria-hidden title="No photo">
      <Package className={ICON_CLS[size]} strokeWidth={1.5} />
    </div>
  );
}
