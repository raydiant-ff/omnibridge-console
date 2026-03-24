export const dynamic = "force-dynamic";
import { fetchCsQueueData } from "./actions";
import { CsQueue } from "./cs-queue";

export default async function CsQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ focus?: string; signal?: string }>;
}) {
  const { focus, signal } = await searchParams;
  let data: Awaited<ReturnType<typeof fetchCsQueueData>> | null = null;
  let error: string | null = null;

  try {
    data = await fetchCsQueueData();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load CS queue.";
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : data ? (
        <CsQueue data={data.report} trust={data.trust} initialFocus={focus ?? null} initialSignal={signal ?? null} />
      ) : null}
    </div>
  );
}
