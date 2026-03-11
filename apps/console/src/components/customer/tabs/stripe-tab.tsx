import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/format";
import type { MockStripeData } from "@/lib/mock-data";

interface Props {
  data: MockStripeData | null;
  isMock: boolean;
}

function MockBanner() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
      Showing mock data — set <code className="font-mono text-xs">STRIPE_SECRET_KEY</code> to see live data.
    </div>
  );
}

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  past_due: "destructive",
  canceled: "secondary",
  paid: "default",
  open: "outline",
  draft: "secondary",
  void: "secondary",
  uncollectible: "destructive",
};

export function StripeTab({ data, isMock }: Props) {
  if (!data) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm font-medium">No Stripe customer linked</p>
        <p className="text-sm text-muted-foreground">
          Link a Stripe customer ID to this record to see billing data.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {isMock && <MockBanner />}

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Customer</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">{data.customer.name || "—"}</p>
            <p className="text-sm text-muted-foreground">{data.customer.email}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-lg font-semibold">
              {formatCurrency(data.customer.balance, data.customer.currency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Payment Method</CardTitle>
          </CardHeader>
          <CardContent>
            {data.paymentMethods[0]?.card ? (
              <p className="text-lg font-semibold capitalize">
                {data.paymentMethods[0].card.brand} ···· {data.paymentMethods[0].card.last4}
              </p>
            ) : (
              <p className="text-lg font-semibold text-muted-foreground">None</p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Subscriptions</CardTitle>
        </CardHeader>
        <CardContent>
          {data.subscriptions.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Plan</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Period</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.subscriptions.map((sub) => (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{sub.plan.nickname}</span>
                        <span className="text-xs text-muted-foreground font-mono">{sub.id}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[sub.status] ?? "outline"} className="capitalize">
                        {sub.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(sub.plan.amount, sub.plan.currency)}/{sub.plan.interval}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(sub.current_period_start)} — {formatDate(sub.current_period_end)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No subscriptions.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          {data.invoices.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs">{inv.id}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_COLORS[inv.status] ?? "outline"} className="capitalize">
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatCurrency(inv.amount_due, inv.currency)}</TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(inv.created)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No invoices.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
