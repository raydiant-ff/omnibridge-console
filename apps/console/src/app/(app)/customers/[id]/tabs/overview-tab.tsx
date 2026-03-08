import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import type { CustomerIndex } from "@omnibridge/db";
import type { MockStripeData, MockSalesforceData } from "@/lib/mock-data";

interface Props {
  customer: CustomerIndex;
  stripeData: MockStripeData | null;
  salesforceData: MockSalesforceData | null;
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}

export function OverviewTab({ customer, stripeData, salesforceData }: Props) {
  const account = salesforceData?.account;
  const activeSubscriptions = stripeData?.subscriptions.filter((s) => s.status === "active") ?? [];

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Customer Index</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4">
            <Field label="Account Name" value={customer.sfAccountName} />
            <Field label="Domain" value={customer.domain} />
            <Field label="Stripe ID" value={
              customer.stripeCustomerId && (
                <Badge variant="outline" className="font-mono text-xs">{customer.stripeCustomerId}</Badge>
              )
            } />
            <Field label="Salesforce ID" value={
              customer.sfAccountId && (
                <Badge variant="outline" className="font-mono text-xs">{customer.sfAccountId}</Badge>
              )
            } />
            <Field label="Indexed At" value={formatDate(customer.createdAt)} />
            <Field label="Last Updated" value={formatDate(customer.updatedAt)} />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Salesforce Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {account ? (
            <dl className="grid grid-cols-2 gap-4">
              <Field label="Industry" value={account.Industry} />
              <Field label="Type" value={account.Type} />
              <Field label="Location" value={
                [account.BillingCity, account.BillingState, account.BillingCountry].filter(Boolean).join(", ") || null
              } />
              <Field label="Website" value={
                account.Website && (
                  <a href={account.Website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                    {account.Website.replace(/^https?:\/\//, "")}
                  </a>
                )
              } />
              <Field label="Phone" value={account.Phone} />
              <Field label="Annual Revenue" value={
                account.AnnualRevenue
                  ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(account.AnnualRevenue)
                  : null
              } />
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No Salesforce account linked.</p>
          )}
        </CardContent>
      </Card>

      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Active Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {activeSubscriptions.length > 0 ? (
            <div className="space-y-3">
              {activeSubscriptions.map((sub) => (
                <div key={sub.id} className="flex items-center justify-between rounded-lg border px-4 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{sub.plan.nickname}</span>
                    <span className="text-xs text-muted-foreground font-mono">{sub.id}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm font-medium">
                      {formatCurrency(sub.plan.amount, sub.plan.currency)}/{sub.plan.interval}
                    </span>
                    <Badge variant="default" className="capitalize">{sub.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {stripeData ? "No active subscriptions." : "No Stripe customer linked."}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
