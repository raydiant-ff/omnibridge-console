"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, Copy, Check, FlaskConical, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import type { CreateQuoteResult } from "@/lib/actions/quotes";
import type { QuoteWizardState } from "../wizard";

interface Props {
  result: CreateQuoteResult;
  state: QuoteWizardState;
  onStartNew?: () => void;
}

export function QuoteSuccess({ result, state, onStartNew }: Props) {
  const [copied, setCopied] = useState(false);
  const [logExpanded, setLogExpanded] = useState(true);
  const isMock = result.stripeQuoteId?.includes("mock") ?? false;
  const isDryRun = result.dryRun ?? false;
  const dashboardBase = "https://dashboard.stripe.com";

  const total = state.lineItems.reduce(
    (acc, li) => acc + (li.overrideUnitAmount ?? li.unitAmount) * li.quantity,
    0,
  );

  const acceptUrl = result.acceptUrl
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${result.acceptUrl}`
    : null;

  function copyAcceptUrl() {
    if (!acceptUrl) return;
    navigator.clipboard.writeText(acceptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 pb-8 pt-8">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">
            {isDryRun ? "Dry Run Complete" : "Quote Created"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.customer?.sfAccountName} &mdash;{" "}
            {formatCurrency(total, state.lineItems[0]?.currency ?? "usd")}{" "}
            {state.collectionMethod === "charge_automatically"
              ? "(prepay)"
              : "(invoice)"}
          </p>
          {isDryRun && (
            <Badge variant="outline" className="mt-2 gap-1 text-amber-600 border-amber-400">
              <FlaskConical className="size-3" />
              No real resources created
            </Badge>
          )}
        </div>

        {isMock && !isDryRun && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            Mock mode &mdash; no real Stripe quote was created.
          </div>
        )}

        {result.dryRunLog && result.dryRunLog.length > 0 && (
          <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <button
              type="button"
              onClick={() => setLogExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Dry Run Log ({result.dryRunLog.length} entries)
              </span>
              {logExpanded ? (
                <ChevronDown className="size-4 text-amber-600" />
              ) : (
                <ChevronRight className="size-4 text-amber-600" />
              )}
            </button>
            {logExpanded && (
              <div className="max-h-60 overflow-y-auto border-t border-amber-500/20 px-4 py-3">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                  {result.dryRunLog.join("\n")}
                </pre>
              </div>
            )}
          </div>
        )}

        {acceptUrl && (
          <div className="w-full max-w-md">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer Acceptance Link
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3">
              <code className="flex-1 truncate text-xs">{acceptUrl}</code>
              <Button variant="ghost" size="sm" onClick={copyAcceptUrl}>
                {copied ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Send this link to the customer to review and accept the quote.
            </p>
          </div>
        )}

        <div className="w-full max-w-md space-y-3">
          {result.stripeQuoteId && (
            <ResourceLink
              label="Stripe Quote"
              id={result.stripeQuoteId}
              href={
                isMock || isDryRun
                  ? undefined
                  : `${dashboardBase}/quotes/${result.stripeQuoteId}`
              }
            />
          )}
          {result.sfQuoteId && (
            <ResourceLink label="SF Quote (Stripe_Quote__c)" id={result.sfQuoteId} />
          )}
          {result.quoteRecordId && (
            <ResourceLink label="Quote Record" id={result.quoteRecordId} />
          )}
          {result.auditLogId && (
            <ResourceLink label="Audit Log" id={result.auditLogId} />
          )}
        </div>

        <Separator />

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/quotes">View All Quotes</Link>
          </Button>
          {onStartNew ? (
            <Button onClick={onStartNew}>Create Another</Button>
          ) : (
            <Button asChild>
              <Link href="/quotes/create">Create Another</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceLink({
  label,
  id,
  href,
}: {
  label: string;
  id: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-sm">{id}</span>
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80"
        >
          <ExternalLink className="size-4" />
        </a>
      ) : (
        <Badge variant="outline" className="text-xs">
          Local
        </Badge>
      )}
    </div>
  );
}
