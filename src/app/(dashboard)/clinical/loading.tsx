import { Skeleton } from "@/components/ui/skeleton";

export default function ClinicalLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-40" />
      <Skeleton className="h-10 w-64" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
