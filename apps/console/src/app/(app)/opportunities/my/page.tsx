import { getMyOpportunitySignals } from "@/lib/queries/opportunity-signals";
import { PageHeader } from "@/components/workspace/page-header";
import { OpportunityExplorer } from "./opportunity-explorer";

export default async function MyOpportunitiesPage() {
  const signals = await getMyOpportunitySignals();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="My Opportunities"
        description="Search customers to view their Salesforce account details and opportunities."
      />
      <OpportunityExplorer signals={signals} />
    </div>
  );
}
