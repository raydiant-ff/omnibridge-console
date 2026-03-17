"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Plus,
  MoreHorizontal,
  FileText,
} from "lucide-react";
import type { QuoteRow } from "@/lib/queries/quotes";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListShell } from "@/components/omni/list-shell";
import { ListRow, ListRowTitle, ListRowDetail } from "@/components/omni/list-row";
import { formatCurrency, formatDate, quoteStatusVariant } from "@/lib/format";

const ALL = "__all__";

function statusIcon(status: string) {
  switch (status) {
    case "accepted":
      return <CheckCircle2 className="size-5 text-emerald-500" />;
    case "canceled":
    case "cancelled":
      return <XCircle className="size-5 text-red-400" />;
    case "open":
      return <AlertCircle className="size-5 text-blue-500" />;
    default:
      return <Clock className="size-5 text-muted-foreground" />;
  }
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

function timeAgo(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins} min ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? "s" : ""} ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays} day${diffDays > 1 ? "s" : ""} ago`;
  return formatDate(dateStr);
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
    <ListShell
      title="Quotes"
      count={filtered.length}
      total={statusFilter !== ALL ? quotes.length : undefined}
      isEmpty={filtered.length === 0}
      empty={
        <div className="px-6 py-12 text-center text-sm text-muted-foreground">
          {quotes.length === 0
            ? "No quotes yet. Create your first quote to get started."
            : "No quotes match the selected filter."}
        </div>
      }
      actions={
        <>
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
        </>
      }
    >
      {filtered.map((q) => (
        <Link
          key={q.id}
          href={`/quotes/${q.id}`}
          className="block"
        >
          <ListRow
            icon={statusIcon(q.status)}
            value={
              q.totalAmount !== null ? (
                <span className="text-sm font-medium tabular-nums">
                  {formatCurrency(q.totalAmount, q.currency)}
                </span>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )
            }
            meta={
              <>
                {q.createdByName && (
                  <div className="flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-full bg-muted text-[10px] font-medium text-muted-foreground">
                      {q.createdByName.split(" ").map((n) => n[0]).join("").slice(0, 2)}
                    </div>
                    <span className="text-xs text-foreground hidden sm:inline">
                      {q.createdByName}
                    </span>
                  </div>
                )}
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {timeAgo(q.createdAt)}
                </span>
              </>
            }
            actions={
              <>
                {(q.status === "open" || q.status === "dry_run") && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      copyAcceptLink(q.acceptToken, q.id);
                    }}
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
                <Link
                  href={`/quotes/${q.id}`}
                  title="More"
                  className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MoreHorizontal className="size-3.5" />
                </Link>
              </>
            }
          >
            <ListRowTitle>
              <span className="font-medium text-sm">{q.customerName}</span>
              <Badge
                variant={quoteStatusVariant(q.status)}
                className="text-[10px] capitalize"
              >
                {q.status.replace(/_/g, " ")}
              </Badge>
            </ListRowTitle>
            <ListRowDetail>
              <FileText className="size-3 text-muted-foreground" />
              <span>
                {q.collectionMethod === "charge_automatically"
                  ? "Prepay"
                  : "Invoice"}
              </span>
              <SyncBadges q={q} />
            </ListRowDetail>
          </ListRow>
        </Link>
      ))}
    </ListShell>
  );
}
