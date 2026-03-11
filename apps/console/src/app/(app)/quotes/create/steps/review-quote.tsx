"use client";

import { useState } from "react";
import { Loader2, FlaskConical, Rocket, ArrowDown, ArrowUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DryRunLogPanel } from "@/components/ui/dry-run-log-panel";
import { formatCurrency } from "@/lib/format";
import {
  createQuoteDraft,
  type CreateQuoteResult,
} from "@/lib/actions/quotes";
import {
  CONTRACT_TERM_LABELS,
  BILLING_FREQUENCY_LABELS,
  computeIterations,
  computeContractEndDate,
  convertPriceToFrequency,
  formatBillingCycleSummary,
  billingFrequencyIntervalLabel,
} from "@/lib/billing-utils";
import type { QuoteWizardState } from "../wizard";

interface Props {
  state: QuoteWizardState;
  onBack: () => void;
  onResult: (result: CreateQuoteResult) => void;
  onToggleDryRun: (v: boolean) => void;
}

export function ReviewQuote({ state, onBack, onResult, onToggleDryRun }: Props) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunLog, setDryRunLog] = useState<string[] | null>(null);

  const [productWarnings, setProductWarnings] = useState<string[]>([]);

  const freqLabel = billingFrequencyIntervalLabel(state.billingFrequency);

  function effectiveUnit(li: (typeof state.lineItems)[number]): number {
    return li.overrideUnitAmount ?? li.unitAmount;
  }

  const isOneTime = (interval: string) =>
    !interval || interval === "one-time" || interval === "one_time";

  function toDisplay(amount: number, interval: string): number {
    if (isOneTime(interval)) return amount;
    return convertPriceToFrequency(amount, interval, state.billingFrequency);
  }

  const total = state.lineItems.reduce(
    (acc, li) => acc + toDisplay(effectiveUnit(li), li.interval) * li.quantity,
    0,
  );

  const standardTotal = state.lineItems.reduce(
    (acc, li) => acc + toDisplay(li.unitAmount, li.interval) * li.quantity,
    0,
  );

  const totalDelta = total - standardTotal;

  async function handleCreate() {
    if (!state.customer?.stripeCustomerId) return;
    setIsExecuting(true);
    setError(null);
    setDryRunLog(null);

    try {
      const result = await createQuoteDraft({
        stripeCustomerId: state.customer.stripeCustomerId,
        customerName: state.customer.sfAccountName ?? "Unknown",
        sfAccountId: state.customer.sfAccountId ?? undefined,
        opportunityId: state.opportunityId || undefined,
        billToContactId: state.billToContactId || undefined,
        lineItems: state.lineItems,
        contractTerm: state.contractTerm,
        billingFrequency: state.billingFrequency,
        collectionMethod: state.collectionMethod,
        daysUntilDue:
          state.collectionMethod === "send_invoice"
            ? (Number.isNaN(parseInt(state.daysUntilDue, 10))
                ? 30
                : parseInt(state.daysUntilDue, 10))
            : undefined,
        effectiveDate: state.effectiveDate || undefined,
        trialPeriodDays: state.trialPeriodDays
          ? parseInt(state.trialPeriodDays, 10)
          : undefined,
        expiresInDays: parseInt(state.expiresInDays, 10) || 30,
        idempotencyKey: state.idempotencyKey,
        dryRun: state.dryRun,
      });

      if (!result.success) {
        setError(result.error ?? "Unknown error");
        setIsExecuting(false);
        return;
      }

      if (result.productValidation && !result.productValidation.valid) {
        setProductWarnings(result.productValidation.missingProducts);
      }

      if (result.dryRun && result.dryRunLog) {
        setDryRunLog(result.dryRunLog);
        setIsExecuting(false);
        return;
      }

      onResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      setIsExecuting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Review &amp; Create Quote</CardTitle>
        <CardDescription>
          Verify everything below, then create the Stripe quote.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div className="flex items-center gap-3">
            {state.dryRun ? (
              <FlaskConical className="size-5 text-amber-500" />
            ) : (
              <Rocket className="size-5 text-green-500" />
            )}
            <div>
              <Label htmlFor="dry-run-toggle" className="text-sm font-medium">
                {state.dryRun ? "Dry Run Mode" : "Live Mode"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {state.dryRun
                  ? "No Stripe/SF changes — logs what would happen"
                  : "Will create Stripe draft quote & SF mirror"}
              </p>
            </div>
          </div>
          <Switch
            id="dry-run-toggle"
            checked={state.dryRun}
            onCheckedChange={onToggleDryRun}
          />
        </div>

        <Section title="Customer">
          <Row
            label="Account"
            value={state.customer?.sfAccountName ?? "---"}
          />
          <Row
            label="Stripe ID"
            value={state.customer?.stripeCustomerId ?? "---"}
            mono
          />
          {state.customer?.sfAccountId && (
            <Row label="SF Account" value={state.customer.sfAccountId} mono />
          )}
          {state.opportunityId && (
            <Row label="Opportunity" value={state.opportunityId} mono />
          )}
        </Section>

        <Separator />

        <Section title="Line Items">
          {state.lineItems.map((li, idx) => {
            const isOverridden = li.overrideUnitAmount != null && li.overrideUnitAmount !== li.unitAmount;
            const isDiscount = isOverridden && li.overrideUnitAmount! < li.unitAmount;
            const isPremium = isOverridden && li.overrideUnitAmount! > li.unitAmount;
            const eff = effectiveUnit(li);

            return (
              <div key={idx} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">{li.productName}</span>
                    <span className="text-xs text-muted-foreground">
                      {li.nickname}
                      <span className="ml-2 font-mono opacity-60">
                        {li.priceId}
                      </span>
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">x{li.quantity}</Badge>
                    {isOverridden ? (
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <span className="text-muted-foreground line-through">
                          {formatCurrency(toDisplay(li.unitAmount, li.interval), li.currency)}
                        </span>
                        <span className={`font-medium ${isDiscount ? "text-green-700" : "text-amber-700"}`}>
                          {formatCurrency(toDisplay(eff, li.interval), li.currency)}
                        </span>
                        <span className="text-muted-foreground">
                          {isOneTime(li.interval) ? " one-time" : `/${freqLabel}`}
                        </span>
                      </span>
                    ) : (
                      <span className="font-medium tabular-nums">
                        {formatCurrency(toDisplay(li.unitAmount, li.interval), li.currency)}
                        {isOneTime(li.interval) ? " one-time" : `/${freqLabel}`}
                      </span>
                    )}
                  </div>
                </div>
                {isOverridden && (
                  <div className="flex items-center justify-end gap-2">
                    {isDiscount ? (
                      <Badge variant="secondary" className="gap-1 text-xs text-green-700">
                        <ArrowDown className="size-3" />
                        Discount
                      </Badge>
                    ) : isPremium ? (
                      <Badge variant="secondary" className="gap-1 text-xs text-amber-700">
                        <ArrowUp className="size-3" />
                        Premium
                      </Badge>
                    ) : null}
                    <span className={`font-mono text-xs ${isDiscount ? "text-green-600" : "text-amber-600"}`}>
                      = {formatCurrency(toDisplay(eff, li.interval) * li.quantity, li.currency)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          <Separator />
          {totalDelta !== 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Standard total</span>
              <span className="tabular-nums text-muted-foreground">
                {formatCurrency(standardTotal, state.lineItems[0]?.currency ?? "usd")}
              </span>
            </div>
          )}
          {totalDelta < 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-green-700">Total Discount</span>
                <span className="font-medium tabular-nums text-green-700">
                  {formatCurrency(totalDelta, state.lineItems[0]?.currency ?? "usd")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600">Savings</span>
                <span className="text-green-600">
                  {Math.round((Math.abs(totalDelta) / standardTotal) * 100)}% off
                </span>
              </div>
            </>
          )}
          {totalDelta > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-amber-700">Premium</span>
              <span className="font-medium tabular-nums text-amber-700">
                +{formatCurrency(totalDelta, state.lineItems[0]?.currency ?? "usd")}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Total{" "}
              <span className="text-xs font-normal text-muted-foreground">
                /{freqLabel}
              </span>
            </span>
            <span className="text-sm font-bold tabular-nums">
              {formatCurrency(total, state.lineItems[0]?.currency ?? "usd")}
            </span>
          </div>
        </Section>

        <Separator />

        <Section title="Payment Path">
          <Row
            label="Method"
            value={
              state.collectionMethod === "charge_automatically"
                ? "Prepay (charge automatically)"
                : "Invoice (send invoice)"
            }
          />
          {state.collectionMethod === "send_invoice" && (
            <Row
              label="Payment terms"
              value={
                state.daysUntilDue === "0"
                  ? "Due on receipt"
                  : `Net ${state.daysUntilDue} days`
              }
            />
          )}
        </Section>

        <Separator />

        <Section title="Contract &amp; Billing">
          <Row
            label="Contract term"
            value={CONTRACT_TERM_LABELS[state.contractTerm]}
          />
          <Row
            label="Billing frequency"
            value={BILLING_FREQUENCY_LABELS[state.billingFrequency]}
          />
          <Row
            label="Billing cycles"
            value={String(computeIterations(state.contractTerm, state.billingFrequency))}
          />
          <Row
            label="Contract end"
            value={computeContractEndDate(
              state.effectiveDate ? new Date(state.effectiveDate) : new Date(),
              state.contractTerm,
            ).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          <Row label="Auto-renew" value="Yes" />
          {(() => {
            const recurringItems = state.lineItems.filter(
              (li) => li.interval && li.interval !== "one-time" && li.interval !== "one_time",
            );
            if (recurringItems.length === 0) return null;
            const perCycle = recurringItems.reduce((acc, li) => {
              const eff = li.overrideUnitAmount ?? li.unitAmount;
              return acc + convertPriceToFrequency(eff, li.interval, state.billingFrequency) * li.quantity;
            }, 0);
            return (
              <Row
                label={`Per ${BILLING_FREQUENCY_LABELS[state.billingFrequency].toLowerCase()} cycle`}
                value={formatCurrency(perCycle, state.lineItems[0]?.currency ?? "usd")}
              />
            );
          })()}
          <div className="mt-1 rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {formatBillingCycleSummary(state.contractTerm, state.billingFrequency)}
          </div>
        </Section>

        <Separator />

        <Section title="Dates">
          <Row
            label="Effective date"
            value={state.effectiveDate || "Immediate on acceptance"}
          />
          {state.trialPeriodDays && (
            <Row label="Trial period" value={`${state.trialPeriodDays} days`} />
          )}
          <Row
            label="Quote expires in"
            value={`${state.expiresInDays} days`}
          />
        </Section>

        <Separator />

        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Idempotency key:{" "}
            <code className="font-mono">{state.idempotencyKey}</code>
          </p>
        </div>

        {dryRunLog && dryRunLog.length > 0 && (
          <DryRunLogPanel logs={dryRunLog} />
        )}

        {productWarnings.length > 0 && (
          <div className="flex gap-3 rounded-md border border-amber-500/50 bg-amber-50/50 px-4 py-3 dark:bg-amber-950/20">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Missing Salesforce Product Mapping
              </span>
              <ul className="text-xs text-amber-600 dark:text-amber-300">
                {productWarnings.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              <span className="text-xs text-amber-600/80">
                These products won&apos;t appear on the SF quote line items.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

      </CardContent>
      <CardFooter className="justify-between border-t">
        <Button variant="outline" onClick={onBack} disabled={isExecuting}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={isExecuting}>
          {isExecuting ? (
            <>
              <Loader2 className="animate-spin" />
              {state.dryRun ? "Running Dry Run..." : "Creating Quote..."}
            </>
          ) : state.dryRun ? (
            <>
              <FlaskConical className="size-4" />
              Run Dry Test
            </>
          ) : (
            "Create Draft Quote"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}
