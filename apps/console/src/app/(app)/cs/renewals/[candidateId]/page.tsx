export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { fetchRenewalDetail } from "../actions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExternalLink,
  RotateCw,
  AlertTriangle,
} from "lucide-react";
import {
  Breadcrumb,
  DetailGrid,
  Section,
  FieldRow,
} from "@/components/workspace";
import { Badge } from "@/components/ui/badge";
import { RenewalStatusBadge } from "../renewal-status-badge";

interface Props {
  params: Promise<{ candidateId: string }>;
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtDollars(amount: number | null): string {
  if (amount == null) return "";
  return `$${amount.toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function RenewalDetailPage({ params }: Props) {
  const { candidateId } = await params;
  const decoded = decodeURIComponent(candidateId);
  const detail = await fetchRenewalDetail(decoded);
  if (!detail) notFound();

  const { candidate: c, contractLines, account } = detail;

  const renewUrl = `/cs/renewals/create?sub=${encodeURIComponent(c.id)}&customer=${encodeURIComponent(c.customerId)}`;

  // Compute risk signals
  const risks: string[] = [];
  if (c.renewalStatus === "cancelling") risks.push("Cancelling");
  if (c.contract?.doNotRenew) risks.push("Do Not Renew");
  if (c.status === "past_due") risks.push("Past Due");
  if (c.hasSchedule) risks.push("Schedule Active");

  // Collect context rows
  const contextRows: [string, string][] = [];
  contextRows.push(["Due Date", fmtDate(c.dueDate)]);
  contextRows.push(["Due Basis", c.dueBasis === "contract" ? "Contract End" : "Subscription End"]);
  if (c.contract?.startDate && c.contract?.endDate) {
    contextRows.push(["Contract Term", `${c.contract.startDate} \u2192 ${c.contract.endDate}`]);
  }
  if (c.contract?.contractTerm) {
    contextRows.push(["Term Length", `${c.contract.contractTerm} months`]);
  }
  if (c.cancelAtPeriodEnd) contextRows.push(["Cancel Signal", "Cancel at period end"]);
  if (c.cancelAt) contextRows.push(["Cancel At", fmtDate(c.cancelAt)]);
  if (c.contract?.evergreen) contextRows.push(["Evergreen", "Yes"]);
  const collectionLabel = c.collectionMethod === "send_invoice" ? "Invoice" : "Auto-charge";
  contextRows.push(["Collection", collectionLabel]);

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Renewals", href: "/cs/renewals" },
          { label: c.customerName },
        ]}
      />

      {/* Summary header */}
      <div className="flex items-start justify-between gap-4 rounded-xl border px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <p className="text-xs text-muted-foreground">Account</p>
            <p className="text-sm font-semibold">{c.customerName}</p>
          </div>
          {c.contract?.contractNumber && (
            <div>
              <p className="text-xs text-muted-foreground">Contract</p>
              <p className="text-sm font-medium">{c.contract.contractNumber}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Due</p>
            <p className="text-sm font-medium">{fmtDate(c.dueDate)}</p>
          </div>
          {(c.csmName || account?.csmName) && (
            <div>
              <p className="text-xs text-muted-foreground">CSM</p>
              <p className="text-sm font-medium">{c.csmName ?? account?.csmName}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">MRR</p>
            <p className="font-mono text-sm font-semibold">{fmtCurrency(c.mrr)}</p>
          </div>
          <div className="flex items-center gap-2">
            <RenewalStatusBadge status={c.renewalStatus} />
            {c.contract && (
              <Badge
                variant={c.contract.status === "Activated" ? "outline" : "secondary"}
                className="text-[10px]"
              >
                {c.contract.status}
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" className="shrink-0" asChild>
          <Link href={renewUrl}>
            <RotateCw className="mr-1 size-3" />
            Prepare Renewal Quote
          </Link>
        </Button>
      </div>

      {/* Risk alerts */}
      {risks.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
          <span className="text-amber-700 dark:text-amber-400">
            {risks.join(" \u00b7 ")}
          </span>
        </div>
      )}

      <DetailGrid columns={2}>
        <Section title="Renewal Context">
          {contextRows.map(([label, value]) => (
            <FieldRow key={label} label={label} value={value} />
          ))}
          {c.contract?.mrr != null && (
            <FieldRow label="Contract MRR" value={fmtDollars(c.contract.mrr)} />
          )}
          {c.contract?.arr != null && (
            <FieldRow label="Contract ARR" value={fmtDollars(c.contract.arr)} />
          )}
        </Section>

        <Section title="Linked Records">
          {account && (
            <FieldRow label="Account" value={account.name} />
          )}
          {(account?.ownerName || c.contract?.ownerName) && (
            <FieldRow label="Account Owner" value={account?.ownerName ?? c.contract?.ownerName} />
          )}
          {c.contract && (
            <FieldRow label="SF Contract">
              <a
                href={`https://displai.lightning.force.com/lightning/r/Contract/${c.contract.id}/view`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {c.contract.contractNumber ?? c.contract.id.slice(0, 15)}
                <ExternalLink className="size-3" />
              </a>
            </FieldRow>
          )}
          <FieldRow label="Stripe Subscription">
            <a
              href={`https://dashboard.stripe.com/subscriptions/${c.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {c.id.slice(0, 24)}
              <ExternalLink className="size-3" />
            </a>
          </FieldRow>
          <FieldRow label="Stripe Customer">
            <a
              href={`https://dashboard.stripe.com/customers/${c.customerId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
            >
              {c.customerId.slice(0, 24)}
              <ExternalLink className="size-3" />
            </a>
          </FieldRow>
          <FieldRow label="Sub Status" value={c.status} />
          {!c.contract && (
            <div className="px-4 py-2.5 text-xs text-muted-foreground">
              No Salesforce contract linked
            </div>
          )}
        </Section>
      </DetailGrid>

      {/* Current Products */}
      {c.items.length > 0 && (
        <Section title="Current Products" count={c.items.length}>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Unit Price</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead className="text-right">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">{item.productName}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{item.quantity}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtCurrency(item.unitAmount)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.interval
                      ? `${item.interval}${item.intervalCount > 1 ? ` x${item.intervalCount}` : ""}`
                      : "one-time"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtCurrency(item.mrr)}/mo
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30">
                <TableCell colSpan={4} className="text-right text-xs font-medium text-muted-foreground">
                  Total MRR
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {fmtCurrency(c.mrr)}/mo
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </Section>
      )}

      {/* Contract Lines */}
      {contractLines.length > 0 && (
        <Section
          title="Contract Lines (Salesforce)"
          count={contractLines.length}
          collapsible
          defaultOpen={false}
        >
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead className="text-right">Qty</TableHead>
                <TableHead className="text-right">Net Price</TableHead>
                <TableHead className="text-right">MRR</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Period</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    {line.productName || ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.quantity ?? ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.netPrice != null ? fmtDollars(line.netPrice) : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.mrr != null ? fmtDollars(line.mrr) : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {line.billingFrequency || ""}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {[line.startDate, line.endDate].filter(Boolean).join(" \u2192 ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Section>
      )}

      {/* Bottom CTA */}
      <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Launch the renewal wizard pre-filled with current subscription data.
        </p>
        <Button asChild>
          <Link href={renewUrl}>
            <RotateCw className="mr-1 size-3" />
            Prepare Renewal Quote
          </Link>
        </Button>
      </div>
    </div>
  );
}

