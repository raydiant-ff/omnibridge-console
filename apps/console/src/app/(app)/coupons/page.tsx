import { fetchStripeCoupons } from "@/lib/queries/stripe-coupons";
import { CouponsClient } from "./coupons-client";
import { PageHeader } from "@/components/workspace";

export default async function CouponsPage() {
  const coupons = await fetchStripeCoupons();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Coupon Manager"
        description="Create and manage Stripe coupons that can be applied via the Quote Manager."
      />
      <CouponsClient initialCoupons={coupons} />
    </div>
  );
}
