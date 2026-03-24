export const dynamic = "force-dynamic";
import { fetchDataQualityIssues } from "./actions";
import { DataQualityQueue } from "./data-quality-queue";

interface Props {
  searchParams: Promise<{ account?: string }>;
}

export default async function DataQualityPage({ searchParams }: Props) {
  const params = await searchParams;
  let data: Awaited<ReturnType<typeof fetchDataQualityIssues>> | null = null;
  let error: string | null = null;

  try {
    data = await fetchDataQualityIssues();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load data quality issues.";
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : data ? (
        <DataQualityQueue report={data.report} trust={data.trust} initialAccountFilter={params.account ?? null} />
      ) : null}
    </div>
  );
}
