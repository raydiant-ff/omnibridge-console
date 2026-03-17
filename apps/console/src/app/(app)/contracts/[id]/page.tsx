export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { getContractDetail } from "@/lib/queries/sf-contracts";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Breadcrumb,
  PageHeader,
  DetailGrid,
  Section,
  FieldRow,
  TableShell,
  EmptyState,
} from "@/components/workspace";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params;
  const contract = await getContractDetail(id);
  if (!contract) notFound();

  const statusVariant =
    contract.status === "Activated"
      ? "success"
      : contract.status === "canceled"
        ? "destructive"
        : contract.status === "Pending"
          ? "info"
          : "secondary";

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb
        items={[
          { label: "Contracts", href: "/contracts" },
          { label: contract.contractNumber ?? contract.id.slice(0, 15) },
        ]}
      />

      <PageHeader
        title={contract.accountName ?? "Contract"}
        description={[
          contract.contractNumber ? `Contract #${contract.contractNumber}` : null,
          contract.contractTerm ? `${contract.contractTerm} month term` : null,
          contract.startDate ? `${contract.startDate} \u2192 ${contract.endDate ?? "ongoing"}` : null,
        ].filter(Boolean).join(" \u00b7 ")}
        badge={
          <Badge variant={statusVariant as any} className="text-xs">
            {contract.status}
          </Badge>
        }
        actions={
          <>
            {contract.stripeSubscriptionId && (
              <a
                href={`https://dashboard.stripe.com/subscriptions/${contract.stripeSubscriptionId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Stripe ↗
              </a>
            )}
            <a
              href={`https://displai.lightning.force.com/lightning/r/Contract/${contract.id}/view`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Salesforce ↗
            </a>
          </>
        }
      />

      <DetailGrid columns={3}>
        <Section title="Contract Details">
          <FieldRow label="Account" value={contract.accountName} />
          <FieldRow label="Owner" value={contract.ownerName} />
          <FieldRow label="Start Date" value={contract.startDate} />
          <FieldRow label="End Date" value={contract.endDate} />
          <FieldRow label="Term" value={contract.contractTerm ? `${contract.contractTerm} months` : null} />
          <FieldRow label="Signed Date" value={contract.customerSignedDate} />
          <FieldRow label="Activated" value={contract.activatedDate?.slice(0, 10)} />
          <FieldRow label="Days to Expiry" value={contract.daysTillExpiry?.toString()} />
          <FieldRow label="Collection" value={contract.collectionMethod} />
          <FieldRow label="Evergreen" value={contract.evergreen ? "Yes" : "No"} />
          <FieldRow label="Do Not Renew" value={contract.doNotRenew ? "Yes" : "No"} />
        </Section>

        <Section title="Financial">
          <FieldRow
            label="MRR"
            value={contract.mrr != null ? `$${contract.mrr.toLocaleString()}` : null}
            mono
          />
          <FieldRow
            label="ARR"
            value={contract.arr != null ? `$${contract.arr.toLocaleString()}` : null}
            mono
          />
          <FieldRow label="Lines" value={contract.lines.length.toString()} />
        </Section>

        <Section title="Stripe Integration">
          <FieldRow label="Subscription" value={contract.stripeSubscriptionId} mono />
          <FieldRow label="Customer" value={contract.stripeCustomerId} mono />
          <FieldRow label="Schedule" value={contract.stripeScheduleId} mono />
          {contract.stripeSubscription && (
            <>
              <div className="border-t px-4 pt-2 pb-1">
                <p className="text-xs font-medium text-muted-foreground">Live Subscription</p>
              </div>
              <FieldRow label="Status" value={contract.stripeSubscription.status} />
              <FieldRow
                label="Period End"
                value={contract.stripeSubscription.currentPeriodEnd.slice(0, 10)}
              />
              <FieldRow
                label="Cancel at End"
                value={contract.stripeSubscription.cancelAtPeriodEnd ? "Yes" : "No"}
              />
            </>
          )}
          {contract.quoteRecord && (
            <>
              <div className="border-t px-4 pt-2 pb-1">
                <p className="text-xs font-medium text-muted-foreground">Omni Quote</p>
              </div>
              <FieldRow label="Type" value={contract.quoteRecord.quoteType} />
              <FieldRow label="Status" value={contract.quoteRecord.status} />
              <FieldRow
                label="Created"
                value={contract.quoteRecord.createdAt.slice(0, 10)}
              />
            </>
          )}
        </Section>
      </DetailGrid>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Last SF modified: {contract.sfLastModified?.slice(0, 19).replace("T", " ") ?? "—"}</span>
        <span>·</span>
        <span>Synced at: {contract.syncedAt.slice(0, 19).replace("T", " ")}</span>
      </div>

      <TableShell
        title="Contract Lines"
        description={`${contract.lines.length} line item${contract.lines.length !== 1 ? "s" : ""} (SBQQ Subscriptions)`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead className="text-right">List Price</TableHead>
              <TableHead className="text-right">Net Price</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead>Billing</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Stripe Price</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contract.lines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <EmptyState title="No contract lines found." />
                </TableCell>
              </TableRow>
            ) : (
              contract.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    {line.productName ?? "—"}
                  </TableCell>
                  <TableCell>
                    {line.status ? (
                      <LineStatusBadge status={line.status} />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.quantity ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.listPrice != null ? `$${line.listPrice.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.netPrice != null ? `$${line.netPrice.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.mrr != null ? `$${line.mrr.toLocaleString()}` : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {line.billingFrequency ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {line.startDate ?? "—"}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {line.endDate ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {line.stripePriceId ? (
                      <span className="max-w-[120px] truncate block">{line.stripePriceId}</span>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableShell>
    </div>
  );
}

function LineStatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "success"
      : status === "canceled"
        ? "destructive"
        : status === "past_due"
          ? "warning"
          : "secondary";

  return (
    <Badge variant={variant as any} className="text-[10px]">
      {status}
    </Badge>
  );
}
