import { RotateCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function RenewalPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Renewal</h1>
        <p className="text-sm text-muted-foreground">
          Renew expiring subscriptions with updated terms.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <RotateCw className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">Coming Soon</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Identify subscriptions approaching expiration, review terms, apply updated pricing, and extend the subscription period.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
