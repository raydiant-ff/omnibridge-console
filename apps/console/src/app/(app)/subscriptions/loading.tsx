import { DashboardSkeleton } from "./dashboard-skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <div className="animate-pulse rounded bg-muted h-7 w-64" />
        <div className="animate-pulse rounded bg-muted h-4 w-96" />
      </div>
      <DashboardSkeleton />
    </div>
  );
}
