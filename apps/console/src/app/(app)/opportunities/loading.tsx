export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="animate-pulse rounded-2xl bg-muted h-7 w-64" />
        <div className="animate-pulse rounded-2xl bg-muted h-4 w-80" />
      </div>
      {/* Metric cards */}
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded-2xl bg-muted h-[130px]" />
        ))}
      </div>
      {/* Chart + list */}
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2 animate-pulse rounded-2xl bg-muted h-[340px]" />
        <div className="animate-pulse rounded-2xl bg-muted h-[340px]" />
      </div>
      {/* Operator bar */}
      <div className="animate-pulse rounded-2xl bg-muted h-[280px]" />
      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-4">
        <div className="animate-pulse rounded-2xl bg-muted h-[300px]" />
        <div className="animate-pulse rounded-2xl bg-muted h-[300px]" />
      </div>
    </div>
  );
}
