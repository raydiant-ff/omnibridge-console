"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateTime, formatDate } from "@/lib/format";
import type { QuoteDetail, AuditTimelineEntry } from "@/lib/queries/quotes";

interface Props {
  quote: QuoteDetail;
  timeline: AuditTimelineEntry[];
}

const STRIPE_DASHBOARD = "https://dashboard.stripe.com";
const SF_BASE = process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://raydiant.lightning.force.com";

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

const ACTION_COLORS: Record<string, string> = {
  "quote.created": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "quote.dry_run": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "quote.finalized": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "quote.pandadoc_created": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "quote.pandadoc_sent": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "quote.accepted_via_checkout": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "quote.invoice_paid": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "subscription.schedule_created": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "quote.canceled": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function QuoteDetailView({ quote, timeline }: Props) {
  return (
    <>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/quotes">
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Link>
        </Button>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight">
            Quote — {quote.customerName}
          </h1>
          <span className="text-sm text-muted-foreground">
            {quote.stripeQuoteNumber ?? quote.stripeQuoteId}
          </span>
        </div>
        <Badge variant={statusVariant(quote.status)} className="ml-auto">
          {quote.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CrossSystemPanel quote={quote} />
        <ValidationPanel quote={quote} />
      </div>

      <LifecycleTimeline timeline={timeline} />
    </>
  );
}

function CrossSystemPanel({ quote }: { quote: QuoteDetail }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Cross-System IDs
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <IdRow
          label="Stripe Quote"
          value={quote.stripeQuoteId}
          subValue={quote.stripeQuoteNumber}
          href={`${STRIPE_DASHBOARD}/quotes/${quote.stripeQuoteId}`}
        />
        <IdRow
          label="SF Quote"
          value={quote.sfQuoteId}
          subValue={quote.sfQuoteNumber}
          href={quote.sfQuoteId ? `${SF_BASE}/${quote.sfQuoteId}` : undefined}
        />
        <IdRow
          label="PandaDoc"
          value={quote.pandadocDocId}
          href={
            quote.pandadocDocId
              ? `https://app.pandadoc.com/a/#/documents/${quote.pandadocDocId}`
              : undefined
          }
        />

        <Separator />

        <IdRow
          label="Stripe Customer"
          value={quote.stripeCustomerId}
          href={`${STRIPE_DASHBOARD}/customers/${quote.stripeCustomerId}`}
        />
        <IdRow
          label="SF Account"
          value={quote.sfAccountId}
          href={
            quote.sfAccountId ? `${SF_BASE}/${quote.sfAccountId}` : undefined
          }
        />
        <IdRow
          label="Opportunity"
          value={quote.opportunityId}
          href={
            quote.opportunityId
              ? `${SF_BASE}/${quote.opportunityId}`
              : undefined
          }
        />

        {(quote.stripeSubscriptionId || quote.stripeScheduleId) && (
          <>
            <Separator />
            <IdRow
              label="Stripe Subscription"
              value={quote.stripeSubscriptionId}
              href={
                quote.stripeSubscriptionId
                  ? `${STRIPE_DASHBOARD}/subscriptions/${quote.stripeSubscriptionId}`
                  : undefined
              }
            />
            <IdRow
              label="Stripe Schedule"
              value={quote.stripeScheduleId}
              href={
                quote.stripeScheduleId
                  ? `${STRIPE_DASHBOARD}/subscription_schedules/${quote.stripeScheduleId}`
                  : undefined
              }
            />
            {quote.sfContractId && (
              <IdRow
                label="SF Contract"
                value={quote.sfContractId}
                href={`${SF_BASE}/${quote.sfContractId}`}
              />
            )}
          </>
        )}

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-medium tabular-nums">
            {quote.totalAmount != null
              ? formatCurrency(quote.totalAmount, quote.currency)
              : "---"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Contract</span>
          <span className="font-medium">
            {quote.contractTerm ?? "---"} /{" "}
            {quote.billingFrequency ?? "---"}
          </span>
        </div>
        {quote.contractEndDate && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Contract End</span>
            <span className="font-medium">
              {formatDate(quote.contractEndDate)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Created</span>
          <span className="text-muted-foreground">
            {formatDateTime(quote.createdAt)}
            {quote.createdByName && ` by ${quote.createdByName}`}
          </span>
        </div>
        {quote.acceptedAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Accepted</span>
            <span className="text-muted-foreground">
              {formatDateTime(quote.acceptedAt)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IdRow({
  label,
  value,
  subValue,
  href,
}: {
  label: string;
  value: string | null;
  subValue?: string | null;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {value ? (
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="truncate font-mono text-xs">{subValue ?? value}</span>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground/50">—</span>
      )}
    </div>
  );
}

function ValidationPanel({ quote }: { quote: QuoteDetail }) {
  const checks: { label: string; passed: boolean | null; detail?: string }[] = [
    {
      label: "Stripe quote exists",
      passed: !!quote.stripeQuoteId,
      detail: quote.stripeQuoteId,
    },
    {
      label: "SF quote linked",
      passed: !!quote.sfQuoteId,
      detail: quote.sfQuoteId ?? "Not created",
    },
    {
      label: "PandaDoc document linked",
      passed:
        quote.status === "draft" ? null : !!quote.pandadocDocId,
      detail: quote.pandadocDocId ?? (quote.status === "draft" ? "Pending" : "Missing"),
    },
    {
      label: "Stripe subscription created",
      passed:
        quote.status === "accepted"
          ? !!quote.stripeSubscriptionId
          : null,
      detail:
        quote.stripeSubscriptionId ??
        (quote.status === "accepted" ? "Missing" : "Pending acceptance"),
    },
    {
      label: "SF subscription ID backfilled",
      passed:
        quote.status === "accepted" && quote.sfQuoteId
          ? !!quote.stripeSubscriptionId
          : null,
      detail:
        quote.status === "accepted" && !quote.stripeSubscriptionId
          ? "Missing"
          : "N/A until accepted",
    },
    {
      label: "Stripe quote number captured",
      passed:
        quote.status === "draft" ? null : !!quote.stripeQuoteNumber,
      detail: quote.stripeQuoteNumber ?? "Pending finalization",
    },
    {
      label: "SF quote number captured",
      passed: !!quote.sfQuoteNumber,
      detail: quote.sfQuoteNumber ?? "Not captured",
    },
  ];

  const passedCount = checks.filter((c) => c.passed === true).length;
  const failedCount = checks.filter((c) => c.passed === false).length;
  const pendingCount = checks.filter((c) => c.passed === null).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Validation Checks
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-600">{passedCount} passed</span>
            {failedCount > 0 && (
              <span className="text-red-600">{failedCount} failed</span>
            )}
            {pendingCount > 0 && (
              <span className="text-muted-foreground">
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {checks.map((check, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {check.passed === true && (
                <CheckCircle2 className="size-4 text-emerald-500" />
              )}
              {check.passed === false && (
                <XCircle className="size-4 text-red-500" />
              )}
              {check.passed === null && (
                <Clock className="size-4 text-muted-foreground" />
              )}
              <span className="text-sm">{check.label}</span>
            </div>
            {check.detail && (
              <span className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                {check.detail}
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function LifecycleTimeline({ timeline }: { timeline: AuditTimelineEntry[] }) {
  if (timeline.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No audit log entries yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Lifecycle Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex flex-col gap-0">
          {timeline.map((entry, i) => {
            const isLast = i === timeline.length - 1;
            const colorClass =
              ACTION_COLORS[entry.action] ??
              "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";

            return (
              <div key={entry.id} className="relative flex gap-4 pb-6">
                {!isLast && (
                  <div className="absolute left-[11px] top-6 h-full w-px bg-border" />
                )}
                <div className="relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-background ring-2 ring-border">
                  <div className="size-2 rounded-full bg-foreground/50" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                    >
                      {entry.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    {entry.actorName && (
                      <span className="text-xs text-muted-foreground">
                        by {entry.actorName}
                      </span>
                    )}
                  </div>
                  <TimelinePayload payload={entry.payloadJson} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelinePayload({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object") return null;

  const entries = Object.entries(payload as Record<string, unknown>).filter(
    ([key]) =>
      key !== "quoteRecordId" &&
      key !== "dryRunLog" &&
      key !== "dryRun",
  );

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {entries.map(([key, val]) => (
        <span key={key} className="text-xs text-muted-foreground">
          <span className="font-medium">{key}:</span>{" "}
          {typeof val === "object" ? JSON.stringify(val) : String(val)}
        </span>
      ))}
    </div>
  );
}
