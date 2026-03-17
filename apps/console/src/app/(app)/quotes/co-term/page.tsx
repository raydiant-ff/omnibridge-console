import { CoTermWizard } from "./wizard";
import { PageHeader } from "@/components/workspace/page-header";

export default function CoTermQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <PageHeader
        title="Co-Term Amendment"
        description="Add new products to an existing subscription. The new items will co-term with the current contract, billed immediately (prorated) or at the next billing cycle."
      />
      <CoTermWizard />
    </div>
  );
}
