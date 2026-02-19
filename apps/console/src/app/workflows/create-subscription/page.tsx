import { Wizard } from "./wizard";

export default function CreateSubscriptionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Set up a new Stripe subscription schedule for a customer.
        </p>
      </div>
      <Wizard />
    </div>
  );
}
