export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="animate-pulse rounded bg-muted h-7 w-64" />
        <div className="animate-pulse rounded bg-muted h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="animate-pulse rounded bg-muted h-[520px]" />
        <div className="flex flex-col gap-6">
          <div className="animate-pulse rounded bg-muted h-64" />
          <div className="animate-pulse rounded bg-muted h-64" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="animate-pulse rounded bg-muted h-64" />
        <div className="animate-pulse rounded bg-muted h-64" />
      </div>
    </div>
  );
}
