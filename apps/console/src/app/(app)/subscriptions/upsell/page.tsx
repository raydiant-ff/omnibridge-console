import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/workspace/page-header";

export default function UpsellPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Upsell"
        description="Upgrade a customer to a higher-tier plan or increase quantities."
      />

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <TrendingUp className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">Coming Soon</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Select a customer's active subscription and upgrade their plan, add seats, or increase quantities with prorated billing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
