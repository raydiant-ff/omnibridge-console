import { TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DowngradePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Downgrade</h1>
        <p className="text-sm text-muted-foreground">
          Move a customer to a lower-tier plan or reduce quantities.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <TrendingDown className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">Coming Soon</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Select a customer's active subscription and downgrade their plan, reduce seats, or decrease quantities with credit handling.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
