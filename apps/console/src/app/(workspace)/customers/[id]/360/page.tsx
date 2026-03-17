import { notFound } from "next/navigation";
import { resolveCustomerIndexId } from "@/lib/projections/resolve-customer";
import { getCustomerView } from "@/lib/projections/customer-view";
import { getCustomerSubscriptionViews } from "@/lib/projections/subscription-view";
import { getCustomerContractViews } from "@/lib/projections/contract-view";
import { getCustomerUnifiedInvoices, getCustomerUnifiedPayments } from "@/lib/projections/unified-views";
import { getRenewalView } from "@/lib/projections/renewal-view";
import { Customer360 } from "./customer-360";

interface Props {
  params: Promise<{ id: string }>;
}

/**
 * Customer 360 — projection-backed account execution workspace.
 * Route: /customers/[id]/360
 *
 * All data access goes through lib/projections/*.
 * No direct Prisma. No lib/queries/*. No mock data.
 */
export default async function Customer360Page({ params }: Props) {
  const { id } = await params;

  const customerIndexId = await resolveCustomerIndexId(id);
  if (!customerIndexId) notFound();

  const customer = await getCustomerView(customerIndexId);
  if (!customer) notFound();

  const [subscriptions, contracts, invoices, payments, renewal] = await Promise.all([
    customer.stripeCustomerId
      ? getCustomerSubscriptionViews(customer.stripeCustomerId)
      : Promise.resolve([]),

    customer.sfAccountId
      ? getCustomerContractViews(customer.sfAccountId)
      : Promise.resolve([]),

    getCustomerUnifiedInvoices(customer.stripeCustomerId, customer.sfAccountId, 25),

    getCustomerUnifiedPayments(customer.stripeCustomerId, customer.sfAccountId, 25),

    customer.activeContract?.id
      ? getRenewalView(customer.activeContract.id)
      : Promise.resolve(null),
  ]);

  return (
    <Customer360
      customer={customer}
      subscriptions={subscriptions}
      contracts={contracts}
      invoices={invoices}
      payments={payments}
      renewal={renewal}
    />
  );
}
