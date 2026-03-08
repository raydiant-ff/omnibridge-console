import { QuoteWizard } from "./wizard";

export default function CreateQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Quote</h1>
        <p className="text-sm text-muted-foreground">
          Build a Stripe quote with line items, payment terms, and send it to
          the customer for acceptance.
        </p>
      </div>
      <QuoteWizard />
    </div>
  );
}
