export const dynamic = "force-dynamic";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";
import { getCustomerById, getCustomerWorkItems, getCustomerAuditLogs } from "@/lib/queries/customers";
import { getStripeDataForCustomer } from "@/lib/queries/stripe";
import { getSalesforceDataForCustomer } from "@/lib/queries/salesforce";
import { flags } from "@/lib/feature-flags";
import { CustomerTabs } from "@/components/customer/customer-tabs";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const [stripeData, salesforceData, workItems, auditLogs] = await Promise.all([
    getStripeDataForCustomer(customer.stripeCustomerId),
    getSalesforceDataForCustomer(customer.sfAccountId),
    getCustomerWorkItems(customer.id),
    getCustomerAuditLogs(customer.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/subscriptions/customers" className="hover:text-foreground transition-colors">
          Customers
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium">
          {customer.sfAccountName ?? customer.domain ?? customer.id}
        </span>
      </nav>

      <PageHeader
        title={customer.sfAccountName ?? "Unnamed Customer"}
        description={[customer.domain, customer.stripeCustomerId, customer.sfAccountId]
          .filter(Boolean)
          .join(" · ")}
      />

      <CustomerTabs
        customer={customer}
        stripeData={stripeData}
        salesforceData={salesforceData}
        workItems={workItems}
        auditLogs={auditLogs}
        mockFlags={{ stripe: flags.useMockStripe, salesforce: flags.useMockSalesforce }}
      />
    </div>
  );
}
