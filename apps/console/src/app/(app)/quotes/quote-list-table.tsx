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
  Plus,
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, quoteStatusVariant } from "@/lib/format";

const ALL = "__all__";

function HealthBadge({ q }: { q: QuoteRow }) {
  const isAccepted = q.status === "accepted";
  const isDraft = q.status === "draft" || q.status === "dry_run";

  const hasSf = !!q.sfQuoteId;
  const hasDocuSign = !!q.docusignEnvelopeId;
  const hasSub = !!q.stripeSubscriptionId;

  let errors = 0;
  let warnings = 0;

  if (!hasSf) {
    if (!isDraft) errors++;
    else warnings++;
  }
  if (!hasDocuSign && !isDraft) warnings++;
  if (isAccepted && !hasSub) errors++;

  if (errors > 0) {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        <XCircle className="size-3" />
        {errors} issue{errors > 1 ? "s" : ""}
      </Badge>
    );
  }
  if (warnings > 0) {
    return (
      <Badge variant="warning" className="gap-1 text-[10px]">
        <AlertCircle className="size-3" />
        {warnings} warn
      </Badge>
    );
  }
  if (isDraft) {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Clock className="size-3" />
        Draft
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1 text-[10px]">
      <CheckCircle2 className="size-3" />
      OK
    </Badge>
  );
}

function SyncBadges({ q }: { q: QuoteRow }) {
  return (
    <div className="flex items-center gap-1">
      <Badge
        variant={q.sfQuoteId ? "info" : "secondary"}
        className="text-[10px]"
        title={q.sfQuoteId ? `SF: ${q.sfQuoteId}` : "No SF mirror"}
      >
        SF
      </Badge>
      <Badge
        variant={q.docusignEnvelopeId ? "default" : "secondary"}
        className="text-[10px]"
        title={q.docusignEnvelopeId ? `DS: ${q.docusignEnvelopeId}` : "No DocuSign"}
      >
        DS
      </Badge>
      <Badge
        variant={q.stripeSubscriptionId ? "success" : "secondary"}
        className="text-[10px]"
        title={
          q.stripeSubscriptionId
            ? `Sub: ${q.stripeSubscriptionId}`
            : "No subscription"
        }
      >
        Sub
      </Badge>
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
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Quotes</CardTitle>
            <CardDescription>
              {statusFilter !== ALL
                ? `${filtered.length} of ${quotes.length} quotes — ${statusFilter}`
                : `${quotes.length} quote${quotes.length !== 1 ? "s" : ""}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild size="sm">
              <Link href="/quotes/create">
                <Plus className="size-3.5" />
                Create
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {quotes.length === 0
              ? "No quotes yet. Create your first quote to get started."
              : "No quotes match the selected filter."}
          </div>
        ) : (
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
                <TableHead className="w-[80px]">Actions</TableHead>
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
                  <TableCell className="font-mono text-sm">
                    {q.totalAmount !== null
                      ? formatCurrency(q.totalAmount, q.currency)
                      : "---"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {q.collectionMethod === "charge_automatically"
                        ? "Prepay"
                        : "Invoice"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={quoteStatusVariant(q.status)} className="text-[10px] capitalize">
                      {q.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SyncBadges q={q} />
                  </TableCell>
                  <TableCell>
                    <HealthBadge q={q} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(q.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/quotes/${q.id}`}
                        title="View details"
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                      {(q.status === "open" || q.status === "dry_run") && (
                        <button
                          type="button"
                          onClick={() => copyAcceptLink(q.acceptToken, q.id)}
                          title="Copy accept link"
                          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
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
        )}
      </CardContent>
    </Card>
  );
}
