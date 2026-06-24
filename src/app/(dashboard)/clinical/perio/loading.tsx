import { Skeleton } from "@/components/ui/skeleton";

export default function PerioLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-9 w-full max-w-md" />
      <Skeleton className="h-96 w-full" />
    </div>
  );
}
