import { ArrowLeftRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function CrossSellPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cross-sell</h1>
        <p className="text-sm text-muted-foreground">
          Add new products to an existing customer's subscription.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <ArrowLeftRight className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">Coming Soon</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Browse a customer's active subscription and add complementary products or add-ons to their existing billing cycle.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
