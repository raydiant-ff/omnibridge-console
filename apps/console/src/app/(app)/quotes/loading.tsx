export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="animate-pulse rounded bg-muted h-7 w-48" />
        <div className="animate-pulse rounded bg-muted h-4 w-72" />
      </div>
      <div className="animate-pulse rounded bg-muted h-10 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded bg-muted h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
