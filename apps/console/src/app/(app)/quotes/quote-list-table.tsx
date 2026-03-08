"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
} from "lucide-react";
import type { QuoteRow } from "@/lib/queries/quotes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate } from "@/lib/format";

const ALL = "__all__";

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "accepted":
      return "default";
    case "open":
      return "secondary";
    case "canceled":
      return "destructive";
    default:
      return "outline";
  }
}

function HealthBadge({ q }: { q: QuoteRow }) {
  const isAccepted = q.status === "accepted";
  const isDraft = q.status === "draft" || q.status === "dry_run";

  const hasSf = !!q.sfQuoteId;
  const hasPandadoc = !!q.pandadocDocId;
  const hasSub = !!q.stripeSubscriptionId;

  let errors = 0;
  let warnings = 0;

  if (!hasSf) {
    if (!isDraft) errors++;
    else warnings++;
  }
  if (!hasPandadoc && !isDraft) warnings++;
  if (isAccepted && !hasSub) errors++;

  if (errors > 0) {
    return (
      <span title={`${errors} issue(s)`} className="flex items-center gap-1 text-red-500">
        <XCircle className="size-3.5" />
      </span>
    );
  }
  if (warnings > 0) {
    return (
      <span title={`${warnings} warning(s)`} className="flex items-center gap-1 text-amber-500">
        <AlertCircle className="size-3.5" />
      </span>
    );
  }
  if (isDraft) {
    return (
      <span title="In progress" className="flex items-center gap-1 text-muted-foreground">
        <Clock className="size-3.5" />
      </span>
    );
  }
  return (
    <span title="All checks passed" className="flex items-center gap-1 text-emerald-500">
      <CheckCircle2 className="size-3.5" />
    </span>
  );
}

function SyncBadges({ q }: { q: QuoteRow }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        title={q.sfQuoteId ? `SF: ${q.sfQuoteId}` : "No SF mirror"}
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${
          q.sfQuoteId
            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            : "bg-muted text-muted-foreground/60"
        }`}
      >
        SF
      </span>
      <span
        title={q.pandadocDocId ? `PD: ${q.pandadocDocId}` : "No PandaDoc"}
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${
          q.pandadocDocId
            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
            : "bg-muted text-muted-foreground/60"
        }`}
      >
        PD
      </span>
      <span
        title={
          q.stripeSubscriptionId
            ? `Sub: ${q.stripeSubscriptionId}`
            : "No subscription"
        }
        className={`rounded px-1.5 py-0.5 text-[10px] font-medium leading-none ${
          q.stripeSubscriptionId
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
            : "bg-muted text-muted-foreground/60"
        }`}
      >
        Sub
      </span>
    </div>
  );
}

export function QuoteListTable({ quotes }: { quotes: QuoteRow[] }) {
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const q of quotes) set.add(q.status);
    return Array.from(set).sort();
  }, [quotes]);

  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? quotes
        : quotes.filter((q) => q.status === statusFilter),
    [quotes, statusFilter],
  );

  function copyAcceptLink(acceptToken: string, rowId: string) {
    const url = `${window.location.origin}/accept/${acceptToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(rowId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Status
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger size="sm" className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All</SelectItem>
              {statuses.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button asChild size="sm">
          <Link href="/quotes/create">Create Quote</Link>
        </Button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border px-4 py-12 text-center text-sm text-muted-foreground">
          {quotes.length === 0
            ? "No quotes yet. Create your first quote to get started."
            : "No quotes match the selected filter."}
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sync</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/quotes/${q.id}`}
                      className="hover:underline"
                    >
                      {q.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono">
                    {q.totalAmount !== null
                      ? formatCurrency(q.totalAmount, q.currency)
                      : "---"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {q.collectionMethod === "charge_automatically"
                        ? "Prepay"
                        : "Invoice"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(q.status)}>
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SyncBadges q={q} />
                  </TableCell>
                  <TableCell>
                    <HealthBadge q={q} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(q.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/quotes/${q.id}`}
                        title="View details"
                        className="rounded p-1 text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                      {(q.status === "open" || q.status === "dry_run") && (
                        <button
                          type="button"
                          onClick={() => copyAcceptLink(q.acceptToken, q.id)}
                          title="Copy accept link"
                          className="rounded p-1 text-muted-foreground hover:text-foreground"
                        >
                          {copiedId === q.id ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {quotes.length} quotes
      </p>
    </div>
  );
}
