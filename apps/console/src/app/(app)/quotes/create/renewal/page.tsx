import { QuoteWizard } from "../wizard";
import { PageHeader } from "@/components/workspace/page-header";

export default function RenewalQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Renewal Quote"
        description="Create a renewal quote to extend a customer's existing contract."
      />
      <QuoteWizard quoteType="Renewal" storageKey="quote-wizard-renewal" />
    </div>
  );
}
