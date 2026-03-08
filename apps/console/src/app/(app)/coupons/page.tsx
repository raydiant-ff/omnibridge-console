import { fetchStripeCoupons } from "@/lib/queries/stripe-coupons";
import { CouponsClient } from "./coupons-client";

export default async function CouponsPage() {
  const coupons = await fetchStripeCoupons();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Coupon Manager</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage Stripe coupons that can be applied via the Quote
          Manager.
        </p>
      </div>
      <CouponsClient initialCoupons={coupons} />
    </div>
  );
}
