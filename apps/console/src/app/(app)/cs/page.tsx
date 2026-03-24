export const dynamic = "force-dynamic";
import { fetchCsDashboardData } from "./actions";
import { CsDashboard } from "./cs-dashboard";

export default async function CsDashboardPage() {
  let data: Awaited<ReturnType<typeof fetchCsDashboardData>> | null = null;
  let error: string | null = null;

  try {
    data = await fetchCsDashboardData();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load dashboard.";
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : data ? (
        <CsDashboard data={data} />
      ) : null}
    </div>
  );
}
