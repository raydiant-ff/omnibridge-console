export const dynamic = "force-dynamic";
import { getAllOpportunitiesAdmin, type OpportunityRow } from "@/lib/queries/opportunities";
import { OpportunitiesSplitView } from "./opportunities-split-view";
import { PageHeader } from "@/components/workspace/page-header";

export default async function AllOpportunitiesPage() {
  let opportunities: OpportunityRow[] = [];
  let error: string | null = null;

  try {
    opportunities = await getAllOpportunitiesAdmin();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load opportunities.";
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="All Opportunities"
        description="All open opportunities across the organization."
      />

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <OpportunitiesSplitView opportunities={opportunities} />
      )}
    </div>
  );
}
