import { QuoteWizard } from "./wizard";
import { PageHeader } from "@/components/workspace/page-header";

export default function CreateQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="New Quote"
        description="Build a Stripe quote with line items, payment terms, and send it to the customer for acceptance."
      />
      <QuoteWizard quoteType="New" />
    </div>
  );
}
