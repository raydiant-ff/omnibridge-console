export const dynamic = "force-dynamic";

import Link from "next/link";
import { getContracts, getContractCounts } from "@/lib/queries/sf-contracts";
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
  PageHeader,
  StatCard,
  Toolbar,
  TableShell,
  EmptyState,
} from "@/components/workspace";

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function ContractsPage({ searchParams }: Props) {
  const { status, q } = await searchParams;
  const [contracts, counts] = await Promise.all([
    getContracts({
      status: status ?? "all",
      search: q?.trim() || undefined,
    }),
    getContractCounts(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contracts"
        description="Salesforce contracts mirrored to Omni"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total" value={counts.total} />
        <StatCard label="Activated" value={counts.activated} />
        <StatCard label="Canceled" value={counts.canceled} />
        <StatCard label="Pending / Draft" value={counts.pending + counts.draft} />
      </div>

      <Toolbar>
        <span className="text-xs text-muted-foreground">Status</span>
        {["all", "Activated", "canceled", "Pending", "Draft"].map((s) => (
          <Link
            key={s}
            href={`/contracts${s !== "all" ? `?status=${s}` : ""}${q ? `${s !== "all" ? "&" : "?"}q=${q}` : ""}`}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              (status ?? "all") === s
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {s === "all" ? "All" : s}
          </Link>
        ))}
      </Toolbar>

      <TableShell
        title="Contracts"
        description={`${contracts.length} contract${contracts.length !== 1 ? "s" : ""}`}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contract #</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Start</TableHead>
              <TableHead>End</TableHead>
              <TableHead>Term</TableHead>
              <TableHead className="text-right">MRR</TableHead>
              <TableHead className="text-right">ARR</TableHead>
              <TableHead className="text-right">Lines</TableHead>
              <TableHead>Stripe Sub</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contracts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="p-0">
                  <EmptyState
                    title="No contracts found"
                    description="Run the backfill script to sync from Salesforce."
                  />
                </TableCell>
              </TableRow>
            ) : (
              contracts.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/contracts/${c.id}`}
                      className="font-mono text-xs text-primary hover:underline"
                    >
                      {c.contractNumber ?? c.id.slice(0, 15)}
                    </Link>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm">
                    {c.accountName ?? <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <ContractStatusBadge status={c.status} />
                  </TableCell>
                  <TableCell className={`whitespace-nowrap text-sm tabular-nums ${c.startDate ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.startDate ?? "—"}
                  </TableCell>
                  <TableCell className={`whitespace-nowrap text-sm tabular-nums ${c.endDate ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.endDate ?? "—"}
                  </TableCell>
                  <TableCell className={`text-sm ${c.contractTerm ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.contractTerm ? `${c.contractTerm}mo` : "—"}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums text-sm font-medium ${c.mrr ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.mrr ? `$${c.mrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums text-sm font-medium ${c.arr ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.arr ? `$${c.arr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {c.lineCount}
                  </TableCell>
                  <TableCell className={`font-mono text-xs ${c.stripeSubscriptionId ? "text-foreground" : "text-muted-foreground"}`}>
                    {c.stripeSubscriptionId ? (
                      <span className="max-w-[140px] truncate block">
                        {c.stripeSubscriptionId}
                      </span>
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

function ContractStatusBadge({ status }: { status: string }) {
  const variant =
    status === "Activated"
      ? "success"
      : status === "canceled"
        ? "destructive"
        : status === "Pending"
          ? "info"
          : "secondary";

  return (
    <Badge variant={variant as any} className="text-[10px]">
      {status}
    </Badge>
  );
}
