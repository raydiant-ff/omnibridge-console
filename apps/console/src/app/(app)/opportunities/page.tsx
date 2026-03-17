import { getDashboardOpportunities } from "@/lib/queries/opportunities";
import { DashboardCharts } from "./dashboard-charts";
import { PageHeader } from "@/components/workspace/page-header";

export default async function OpportunitiesPage() {
  let error: string | null = null;
  let opportunities: Awaited<ReturnType<typeof getDashboardOpportunities>> = [];

  try {
    opportunities = await getDashboardOpportunities();
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Failed to load dashboard data.";
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Opportunities Dashboard"
        description="Year-to-date pipeline overview and revenue insights."
      />

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <DashboardCharts opportunities={opportunities} />
      )}
    </div>
  );
}
