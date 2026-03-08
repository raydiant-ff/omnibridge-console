import { getAllOpportunitiesAdmin, type OpportunityRow } from "@/lib/queries/opportunities";
import { OpportunitiesTable } from "../opportunities-table";

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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          All open opportunities across the organization.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <OpportunitiesTable opportunities={opportunities} showOwner />
      )}
    </div>
  );
}
