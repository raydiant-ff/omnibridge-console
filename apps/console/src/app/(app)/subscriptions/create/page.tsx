import { Wizard } from "./wizard";
import { PageHeader } from "@/components/workspace/page-header";

export default function CreateSubscriptionPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Create Subscription"
        description="Set up a new Stripe subscription schedule for a customer."
      />
      <Wizard />
    </div>
  );
}
