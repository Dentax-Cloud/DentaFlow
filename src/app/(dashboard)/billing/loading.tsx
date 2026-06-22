import { Skeleton } from "@/components/ui/skeleton";

export default function BillingLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-40" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
