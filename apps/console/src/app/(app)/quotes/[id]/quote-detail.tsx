"use client";

import Link from "next/link";
import {
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateTime, formatDate, quoteStatusVariant } from "@/lib/format";
import type { QuoteDetail, AuditTimelineEntry } from "@/lib/queries/quotes";
import { Breadcrumb, PageHeader } from "@/components/workspace";

interface Props {
  quote: QuoteDetail;
  timeline: AuditTimelineEntry[];
}

const STRIPE_DASHBOARD = "https://dashboard.stripe.com";
const SF_BASE = process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://yourorg.lightning.force.com";

const ACTION_COLORS: Record<string, string> = {
  "quote.created": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "quote.dry_run": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "quote.finalized": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "quote.docusign_created": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "quote.docusign_sent": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "quote.accepted_via_checkout": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "quote.invoice_paid": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "subscription.schedule_created": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "quote.canceled": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function QuoteDetailView({ quote, timeline }: Props) {
  return (
    <>
      <Breadcrumb
        items={[
          { label: "Quotes", href: "/quotes" },
          { label: quote.customerName },
        ]}
      />

      <PageHeader
        title={`Quote \u2014 ${quote.customerName}`}
        description={quote.stripeQuoteNumber ?? quote.stripeQuoteId}
        badge={
          <Badge variant={quoteStatusVariant(quote.status)}>
            {quote.status}
          </Badge>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <CrossSystemPanel quote={quote} />
        <ValidationPanel quote={quote} />
      </div>

      <LineItemsPanel lineItemsJson={quote.lineItemsJson} currency={quote.currency} />

      <LifecycleTimeline timeline={timeline} />
    </>
  );
}

function CrossSystemPanel({ quote }: { quote: QuoteDetail }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Cross-System IDs
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <IdRow
          label="Stripe Quote"
          value={quote.stripeQuoteId}
          subValue={quote.stripeQuoteNumber}
          href={`${STRIPE_DASHBOARD}/quotes/${quote.stripeQuoteId}`}
          linkLabel="Open in Stripe"
        />
        <IdRow
          label="Salesforce Quote"
          value={quote.sfQuoteId}
          subValue={quote.sfQuoteNumber}
          href={quote.sfQuoteId ? `${SF_BASE}/lightning/r/Stripe_Quote__c/${quote.sfQuoteId}/view` : undefined}
          linkLabel="Open in Salesforce"
        />
        <IdRow
          label="DocuSign"
          value={quote.docusignEnvelopeId}
          href={
            quote.docusignEnvelopeId
              ? `https://app.docusign.com/documents/details/${quote.docusignEnvelopeId}`
              : undefined
          }
          linkLabel="Open in DocuSign"
        />

        <Separator />

        <IdRow
          label="Stripe Customer"
          value={quote.stripeCustomerId}
          href={`${STRIPE_DASHBOARD}/customers/${quote.stripeCustomerId}`}
          linkLabel="Open in Stripe"
        />
        <IdRow
          label="Salesforce Account"
          value={quote.sfAccountId}
          href={
            quote.sfAccountId ? `${SF_BASE}/lightning/r/Account/${quote.sfAccountId}/view` : undefined
          }
          linkLabel="Open in Salesforce"
        />
        <IdRow
          label="Opportunity"
          value={quote.opportunityId}
          href={
            quote.opportunityId
              ? `${SF_BASE}/lightning/r/Opportunity/${quote.opportunityId}/view`
              : undefined
          }
          linkLabel="Open in Salesforce"
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
              linkLabel="Open in Stripe"
            />
            <IdRow
              label="Stripe Schedule"
              value={quote.stripeScheduleId}
              href={
                quote.stripeScheduleId
                  ? `${STRIPE_DASHBOARD}/subscription_schedules/${quote.stripeScheduleId}`
                  : undefined
              }
              linkLabel="Open in Stripe"
            />
            {quote.sfContractId && (
              <IdRow
                label="Salesforce Contract"
                value={quote.sfContractId}
                href={`${SF_BASE}/lightning/r/Contract/${quote.sfContractId}/view`}
                linkLabel="Open in Salesforce"
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
  linkLabel,
}: {
  label: string;
  value: string | null;
  subValue?: string | null;
  href?: string;
  linkLabel?: string;
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
              title={linkLabel}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
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
      label: "Salesforce quote linked",
      passed: !!quote.sfQuoteId,
      detail: quote.sfQuoteId ?? "Not created",
    },
    {
      label: "DocuSign envelope linked",
      passed:
        quote.status === "draft" ? null : !!quote.docusignEnvelopeId,
      detail: quote.docusignEnvelopeId ?? (quote.status === "draft" ? "Pending" : "Missing"),
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
          <CardTitle className="text-base font-semibold">
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

interface ParsedLineItem {
  productName: string;
  nickname: string;
  quantity: number;
  unitAmount: number;
  overrideUnitAmount?: number | null;
  currency: string;
  interval: string;
}

function LineItemsPanel({
  lineItemsJson,
  currency,
}: {
  lineItemsJson: unknown;
  currency: string;
}) {
  if (!lineItemsJson) return null;

  let items: ParsedLineItem[];
  try {
    items = (Array.isArray(lineItemsJson) ? lineItemsJson : JSON.parse(lineItemsJson as string)) as ParsedLineItem[];
  } catch {
    return null;
  }

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Line Items
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Product</th>
                <th className="pb-2 pr-4 font-medium text-right">Qty</th>
                <th className="pb-2 pr-4 font-medium text-right">List Price</th>
                <th className="pb-2 pr-4 font-medium text-right">Unit Price</th>
                <th className="pb-2 font-medium text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const effectiveUnit = item.overrideUnitAmount ?? item.unitAmount;
                const hasDiscount =
                  item.overrideUnitAmount != null &&
                  item.overrideUnitAmount < item.unitAmount;
                const lineTotal = effectiveUnit * item.quantity;
                const cur = item.currency || currency;

                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.nickname} &middot; {item.interval}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(item.unitAmount, cur)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      <span className={hasDiscount ? "text-green-600" : ""}>
                        {formatCurrency(effectiveUnit, cur)}
                      </span>
                      {hasDiscount && (
                        <span className="ml-1 text-xs text-green-600">
                          ({Math.round(((item.unitAmount - effectiveUnit) / item.unitAmount) * 100)}% off)
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatCurrency(lineTotal, cur)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="pt-2 text-right font-medium">
                  Total
                </td>
                <td className="pt-2 text-right font-bold tabular-nums">
                  {formatCurrency(
                    items.reduce(
                      (sum, item) =>
                        sum + (item.overrideUnitAmount ?? item.unitAmount) * item.quantity,
                      0,
                    ),
                    currency,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
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
        <CardTitle className="text-base font-semibold">
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
