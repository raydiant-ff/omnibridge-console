import { XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function CancellationPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cancellation</h1>
        <p className="text-sm text-muted-foreground">
          Cancel an active subscription immediately or at period end.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <XCircle className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">Coming Soon</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Look up a customer's active subscriptions, choose immediate or end-of-period cancellation, handle prorations, and log the action.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
