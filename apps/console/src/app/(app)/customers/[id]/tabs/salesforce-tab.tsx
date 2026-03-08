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
import { formatDate } from "@/lib/format";
import type { MockSalesforceData } from "@/lib/mock-data";

interface Props {
  data: MockSalesforceData | null;
  isMock: boolean;
}

function MockBanner() {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
      Showing mock data — configure Salesforce JWT env vars to see live data.
    </div>
  );
}

const STAGE_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  "Closed Won": "default",
  "Closed Lost": "destructive",
  Negotiation: "outline",
  Prospecting: "secondary",
};

export function SalesforceTab({ data, isMock }: Props) {
  if (!data) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
        <p className="text-sm font-medium">No Salesforce account linked</p>
        <p className="text-sm text-muted-foreground">
          Link a Salesforce Account ID to see CRM data.
        </p>
      </div>
    );
  }

  const { account, contacts, opportunities } = data;

  return (
    <div className="flex flex-col gap-6">
      {isMock && <MockBanner />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Account Details</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <Field label="Name" value={account.Name} />
            <Field label="Type" value={account.Type} />
            <Field label="Industry" value={account.Industry} />
            <Field label="Website" value={
              account.Website ? (
                <a href={account.Website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  {account.Website.replace(/^https?:\/\//, "")}
                </a>
              ) : null
            } />
            <Field label="Phone" value={account.Phone} />
            <Field label="Location" value={
              [account.BillingCity, account.BillingState, account.BillingCountry].filter(Boolean).join(", ") || null
            } />
            <Field label="Annual Revenue" value={
              account.AnnualRevenue
                ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(account.AnnualRevenue)
                : null
            } />
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contacts.map((c) => (
                  <TableRow key={c.Id}>
                    <TableCell className="font-medium">{c.Name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.Title ?? "—"}</TableCell>
                    <TableCell>
                      <a href={`mailto:${c.Email}`} className="text-primary hover:underline">{c.Email}</a>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{c.Phone ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No contacts found.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          {opportunities.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Opportunity</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Close Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {opportunities.map((o) => (
                  <TableRow key={o.Id}>
                    <TableCell className="font-medium">{o.Name}</TableCell>
                    <TableCell>
                      <Badge variant={STAGE_COLORS[o.StageName] ?? "outline"} className="capitalize">
                        {o.StageName}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {o.Amount
                        ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(o.Amount)
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{formatDate(o.CloseDate)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No opportunities found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm">{value ?? <span className="text-muted-foreground">—</span>}</dd>
    </div>
  );
}
