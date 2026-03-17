import { prisma } from "@omnibridge/db";
import { notFound } from "next/navigation";
import { getCustomerSubscriptions } from "@/lib/queries/customer-subscriptions";
import { RenewalWizard } from "./wizard";
import { PageHeader } from "@/components/workspace/page-header";
import type { QuoteLineItem } from "@/lib/actions/quotes";
import type { QuoteWizardState, QuoteCustomer } from "@/app/(app)/quotes/create/wizard";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";

interface Props {
  searchParams: Promise<{ sub?: string; customer?: string }>;
}

function mapBillingInterval(
  interval: string | null,
  intervalCount: number,
): BillingFrequency {
  if (!interval) return "monthly";
  if (interval === "year" && intervalCount === 1) return "annual";
  if (interval === "year" && intervalCount === 2) return "2yr";
  if (interval === "year" && intervalCount === 3) return "3yr";
  if (interval === "month" && intervalCount === 3) return "quarterly";
  if (interval === "month" && intervalCount === 6) return "semi_annual";
  return "monthly";
}

export default async function RenewalCreatePage({ searchParams }: Props) {
  const { sub: subscriptionId, customer: customerId } = await searchParams;

  if (!subscriptionId) notFound();

  const subscription = await prisma.stripeSubscription.findUnique({
    where: { id: subscriptionId },
    include: { items: true },
  });

  if (!subscription) notFound();

  const customerIndex = await prisma.customerIndex.findFirst({
    where: { stripeCustomerId: subscription.customerId },
  });

  let liveItems: QuoteLineItem[] = [];
  try {
    const liveSubs = await getCustomerSubscriptions(subscription.customerId);
    const liveSub = liveSubs.find((s) => s.id === subscriptionId);
    if (liveSub) {
      liveItems = liveSub.items.map((item) => ({
        priceId: item.priceId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        nickname: item.productName,
        unitAmount: item.unitAmount,
        currency: item.currency,
        interval: item.interval ?? "month",
        sfProductId: null,
      }));
    }
  } catch {
    // Fall back to mirror data if Stripe API fails
  }

  if (liveItems.length === 0 && subscription.items.length > 0) {
    liveItems = subscription.items.map((item) => ({
      priceId: item.priceId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      nickname: item.productName,
      unitAmount: item.unitAmount,
      currency: item.currency,
      interval: item.billingInterval ?? "month",
      sfProductId: null,
    }));
  }

  const contractTerm: ContractTerm =
    (subscription.metadata as Record<string, string>)?.contract_term as ContractTerm ?? "1yr";

  const firstItem = subscription.items[0];
  const billingFrequency = firstItem
    ? mapBillingInterval(firstItem.billingInterval, firstItem.intervalCount)
    : "monthly";

  const collectionMethod =
    subscription.collectionMethod === "send_invoice"
      ? "send_invoice" as const
      : "charge_automatically" as const;

  const customer: QuoteCustomer | null = customerIndex
    ? {
        id: customerIndex.id,
        sfAccountId: customerIndex.sfAccountId,
        sfAccountName: customerIndex.sfAccountName,
        stripeCustomerId: customerIndex.stripeCustomerId,
        domain: customerIndex.domain,
      }
    : null;

  const initialState: Partial<QuoteWizardState> = {
    customer,
    lineItems: liveItems,
    contractTerm,
    billingFrequency,
    collectionMethod,
    dryRun: true,
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <PageHeader
        title="Renewal Quote"
        description={`Renewing subscription for ${subscription.customerName} — pre-populated with current subscription products. Modify as needed.`}
      />
      <RenewalWizard
        initialState={initialState}
        subscriptionId={subscriptionId}
        customerName={subscription.customerName}
      />
    </div>
  );
}
