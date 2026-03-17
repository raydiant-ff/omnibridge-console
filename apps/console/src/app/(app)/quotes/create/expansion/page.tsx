import { QuoteWizard } from "../wizard";
import { PageHeader } from "@/components/workspace/page-header";

export default function ExpansionQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Expansion Quote"
        description="Create an expansion quote for an existing customer to add seats, modules, or upgrades."
      />
      <QuoteWizard quoteType="Expansion" storageKey="quote-wizard-expansion" />
    </div>
  );
}
