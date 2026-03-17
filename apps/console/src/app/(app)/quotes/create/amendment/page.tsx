import { QuoteWizard } from "../wizard";
import { PageHeader } from "@/components/workspace/page-header";

export default function AmendmentQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Amendment Quote"
        description="Create an amendment quote to modify an existing contract mid-term."
      />
      <QuoteWizard quoteType="Amendment" storageKey="quote-wizard-amendment" />
    </div>
  );
}
