"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Loader2,
  FlaskConical,
  Rocket,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Zap,
  FileText,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  BILLING_FREQUENCY_LABELS,
  convertPriceToFrequency,
  billingFrequencyIntervalLabel,
} from "@/lib/billing-utils";
import {
  createCoTermQuote,
  previewProration,
  type CoTermQuoteResult,
  type ProrationPreviewResult,
} from "@/lib/actions/co-term-quote";
import type { CreateQuoteResult } from "@/lib/actions/quotes";
import type { CoTermWizardState } from "./wizard";

interface Props {
  state: CoTermWizardState;
  onBack: () => void;
  onResult: (result: CreateQuoteResult) => void;
  onToggleDryRun: (v: boolean) => void;
}

export function ReviewCoTerm({ state, onBack, onResult, onToggleDryRun }: Props) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunLog, setDryRunLog] = useState<string[] | null>(null);
  const [logExpanded, setLogExpanded] = useState(true);
  const [proration, setProration] = useState<ProrationPreviewResult | null>(null);
  const [prorationLoading, startProration] = useTransition();

  const freqLabel = billingFrequencyIntervalLabel(state.billingFrequency);

  const isOneTime = (interval: string) =>
    !interval || interval === "one-time" || interval === "one_time";

  function toDisplay(amount: number, interval: string): number {
    if (isOneTime(interval)) return amount;
    return convertPriceToFrequency(amount, interval, state.billingFrequency);
  }

  const newTotal = state.lineItems.reduce(
    (acc, li) => acc + toDisplay(li.overrideUnitAmount ?? li.unitAmount, li.interval) * li.quantity,
    0,
  );

  const existingMrr = state.selectedSubscription?.mrr ?? 0;
  const currency = state.lineItems[0]?.currency ?? state.selectedSubscription?.currency ?? "usd";

  useEffect(() => {
    if (
      !state.selectedSubscription ||
      state.lineItems.length === 0 ||
      !state.customer?.stripeCustomerId
    )
      return;

    startProration(async () => {
      const result = await previewProration({
        stripeCustomerId: state.customer!.stripeCustomerId!,
        parentSubscriptionId: state.selectedSubscription!.id,
        parentScheduleId: state.selectedSubscription!.scheduleId,
        existingItems: state.existingItems,
        newLineItems: state.lineItems,
        billingFrequency: state.billingFrequency,
        effectiveTiming: state.effectiveTiming,
      });
      setProration(result);
    });
  }, [
    state.selectedSubscription?.id,
    state.lineItems.length,
    state.effectiveTiming,
    state.customer?.stripeCustomerId,
  ]);

  async function handleCreate() {
    if (!state.customer?.stripeCustomerId || !state.selectedSubscription) return;
    setIsExecuting(true);
    setError(null);
    setDryRunLog(null);

    try {
      const result = await createCoTermQuote({
        stripeCustomerId: state.customer.stripeCustomerId,
        customerName: state.customer.sfAccountName ?? "Unknown",
        sfAccountId: state.customer.sfAccountId ?? undefined,
        opportunityId: state.opportunityId || undefined,
        billToContactId: state.billToContactId || undefined,
        parentSubscriptionId: state.selectedSubscription.id,
        parentScheduleId: state.selectedSubscription.scheduleId,
        existingItems: state.existingItems,
        newLineItems: state.lineItems,
        billingFrequency: state.billingFrequency,
        collectionMethod: state.collectionMethod,
        daysUntilDue:
          state.collectionMethod === "send_invoice"
            ? Number.isNaN(parseInt(state.daysUntilDue, 10))
              ? 30
              : parseInt(state.daysUntilDue, 10)
            : undefined,
        effectiveTiming: state.effectiveTiming,
        expiresInDays: parseInt(state.expiresInDays, 10) || 30,
        idempotencyKey: state.idempotencyKey,
        dryRun: state.dryRun,
      });

      if (!result.success) {
        setError(result.error ?? "Unknown error");
        setIsExecuting(false);
        return;
      }

      if (result.dryRun && result.dryRunLog) {
        setDryRunLog(result.dryRunLog);
        setIsExecuting(false);
        return;
      }

      onResult({
        success: true,
        quoteRecordId: result.quoteRecordId,
        stripeQuoteId: result.stripeQuoteId,
        acceptUrl: result.acceptUrl,
        dryRun: result.dryRun,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsExecuting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Review Co-Term Amendment</h2>
        <p className="text-sm text-muted-foreground">
          Review the subscription amendment before creating the quote.
        </p>
      </div>

      {/* Subscription context */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Subscription</span>
            <span className="text-sm font-mono">{state.selectedSubscription?.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current MRR</span>
            <span className="text-sm">{formatCurrency(existingMrr, currency)}/mo</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Billing</span>
            <span className="text-sm">{BILLING_FREQUENCY_LABELS[state.billingFrequency]}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Period</span>
            <span className="text-sm">
              {state.selectedSubscription
                ? `${formatDate(state.selectedSubscription.currentPeriodStart)} – ${formatDate(state.selectedSubscription.currentPeriodEnd)}`
                : "N/A"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Schedule</span>
            <span className="text-sm font-mono">
              {state.selectedSubscription?.scheduleId ?? "None"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Existing items */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-medium mb-3">Existing Items (unchanged)</h3>
          <div className="space-y-1">
            {state.existingItems.map((item) => (
              <div key={item.subscriptionItemId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.productName} &times; {item.quantity}
                </span>
                <span>
                  {formatCurrency(item.unitAmount, currency)}
                  {item.interval ? `/${item.interval}` : ""}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* New items */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-medium mb-3">New Items Being Added</h3>
          <div className="space-y-2">
            {state.lineItems.map((li, i) => {
              const unit = li.overrideUnitAmount ?? li.unitAmount;
              const displayed = toDisplay(unit, li.interval);
              const hasDiscount = li.overrideUnitAmount != null && li.overrideUnitAmount < li.unitAmount;
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{li.productName} &times; {li.quantity}</span>
                    {hasDiscount && (
                      <Badge variant="secondary" className="text-xs">Discount</Badge>
                    )}
                  </div>
                  <span>
                    {formatCurrency(displayed * li.quantity, currency)}/{freqLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between text-sm font-medium">
            <span>New items total per cycle</span>
            <span>{formatCurrency(newTotal, currency)}/{freqLabel}</span>
          </div>
        </CardContent>
      </Card>

      {/* Timing & Proration */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            {state.effectiveTiming === "immediate" ? (
              <Zap className="size-4 text-amber-500" />
            ) : state.effectiveTiming === "next_invoice" ? (
              <FileText className="size-4 text-indigo-500" />
            ) : (
              <CalendarClock className="size-4 text-blue-500" />
            )}
            <span className="text-sm font-medium">
              {state.effectiveTiming === "immediate"
                ? "Immediate activation (charged now)"
                : state.effectiveTiming === "next_invoice"
                  ? "Immediate activation (proration on next invoice)"
                  : "Starts at next billing cycle"}
            </span>
          </div>

          {(state.effectiveTiming === "immediate" || state.effectiveTiming === "next_invoice") && (
            <div className="rounded-md border bg-muted/30 p-3">
              {prorationLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Calculating proration...
                </div>
              ) : proration?.success ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Estimated proration charge</span>
                    <span className="font-medium">
                      {formatCurrency(proration.totalProrationCents, currency)}
                    </span>
                  </div>
                  {proration.lineItems.map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{line.description}</span>
                      <span>{formatCurrency(line.amountCents, currency)}</span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground/70 pt-1">
                    {state.effectiveTiming === "immediate"
                      ? "This is an estimate. A separate invoice will be generated immediately upon acceptance."
                      : "This is an estimate. The prorated amount will appear on the next regular invoice."}
                  </p>
                </div>
              ) : proration?.error ? (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertTriangle className="size-3" />
                  {proration.error}
                </div>
              ) : null}
            </div>
          )}

          {state.effectiveTiming === "end_of_cycle" && (
            <p className="text-xs text-muted-foreground">
              No proration charge. New items will be billed starting{" "}
              {state.selectedSubscription
                ? formatDate(state.selectedSubscription.currentPeriodEnd)
                : "the next billing date"}
              .
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dry run toggle */}
      <div className="flex items-center gap-3 rounded-md border bg-muted/20 p-3">
        <Switch
          id="dry-run"
          checked={state.dryRun}
          onCheckedChange={onToggleDryRun}
        />
        <Label htmlFor="dry-run" className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Dry Run</span>
          <span className="text-xs text-muted-foreground">
            Simulate the co-term quote without creating real records.
          </span>
        </Label>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {dryRunLog && (
        <Card>
          <CardContent className="pt-4">
            <button
              type="button"
              onClick={() => setLogExpanded(!logExpanded)}
              className="flex w-full items-center gap-2 text-sm font-medium"
            >
              {logExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              Dry Run Log ({dryRunLog.length} entries)
            </button>
            {logExpanded && (
              <pre className="mt-3 max-h-80 overflow-auto rounded bg-muted p-3 text-xs font-mono leading-relaxed">
                {dryRunLog.join("\n")}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={isExecuting}>
          {isExecuting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {state.dryRun ? (
            <>
              <FlaskConical className="mr-2 size-4" />
              Dry Run
            </>
          ) : (
            <>
              <Rocket className="mr-2 size-4" />
              Create Co-Term Quote
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
