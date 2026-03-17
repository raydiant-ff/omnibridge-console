"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import {
  CONTRACT_TERM_LABELS,
  BILLING_FREQUENCY_LABELS,
  validBillingFrequencies,
  computeIterations,
  convertPriceToFrequency,
  computeContractEndDate,
  formatBillingCycleSummary,
} from "@/lib/billing-utils";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";
import type { QuoteLineItem } from "@/lib/actions/quotes";

interface Props {
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveDate: string;
  trialPeriodDays: string;
  expiresInDays: string;
  lineItems: QuoteLineItem[];
  onChangeContractTerm: (v: ContractTerm) => void;
  onChangeBillingFrequency: (v: BillingFrequency) => void;
  onChangeEffectiveDate: (v: string) => void;
  onChangeTrialDays: (v: string) => void;
  onChangeExpiresIn: (v: string) => void;
  onNext?: () => void;
  onBack?: () => void;
  embedded?: boolean;
}

export function PickTerms({
  contractTerm,
  billingFrequency,
  effectiveDate,
  trialPeriodDays,
  expiresInDays,
  lineItems,
  onChangeContractTerm,
  onChangeBillingFrequency,
  onChangeEffectiveDate,
  onChangeTrialDays,
  onChangeExpiresIn,
  onNext,
  onBack,
  embedded,
}: Props) {
  const expDays = parseInt(expiresInDays, 10);
  const isValid = !isNaN(expDays) && expDays > 0;

  const allowedFrequencies = useMemo(
    () => validBillingFrequencies(contractTerm),
    [contractTerm],
  );

  function handleTermChange(term: ContractTerm) {
    onChangeContractTerm(term);
    const allowed = validBillingFrequencies(term);
    if (!allowed.includes(billingFrequency)) {
      onChangeBillingFrequency(allowed[0]);
    }
  }

  const iterations = computeIterations(contractTerm, billingFrequency);
  const cycleSummary = formatBillingCycleSummary(contractTerm, billingFrequency);

  const startDate = effectiveDate ? new Date(effectiveDate) : new Date();
  const endDate = computeContractEndDate(startDate, contractTerm);

  const recurringItems = lineItems.filter(
    (li) => li.interval && li.interval !== "one-time" && li.interval !== "one_time",
  );
  const oneTimeItems = lineItems.filter(
    (li) => !li.interval || li.interval === "one-time" || li.interval === "one_time",
  );

  const perCycleTotal = recurringItems.reduce((acc, li) => {
    const eff = li.overrideUnitAmount ?? li.unitAmount;
    const converted = convertPriceToFrequency(eff, li.interval, billingFrequency);
    return acc + converted * li.quantity;
  }, 0);

  const oneTimeTotal = oneTimeItems.reduce((acc, li) => {
    const eff = li.overrideUnitAmount ?? li.unitAmount;
    return acc + eff * li.quantity;
  }, 0);

  const currency = lineItems[0]?.currency ?? "usd";

  const content = (
    <>
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold">Contract Terms</h2>
          <p className="text-sm text-muted-foreground">
            Set the contract length, billing frequency, and subscription dates.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Contract Term</Label>
          <Select
            value={contractTerm}
            onValueChange={(v) => handleTermChange(v as ContractTerm)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CONTRACT_TERM_LABELS) as ContractTerm[]).map(
                (t) => (
                  <SelectItem key={t} value={t}>
                    {CONTRACT_TERM_LABELS[t]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Billing Frequency</Label>
          <Select
            value={billingFrequency}
            onValueChange={(v) =>
              onChangeBillingFrequency(v as BillingFrequency)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedFrequencies.map((f) => (
                <SelectItem key={f} value={f}>
                  {BILLING_FREQUENCY_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-xl border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium">{cycleSummary}</p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            {iterations} billing cycle{iterations > 1 ? "s" : ""}
          </span>
          <span>
            Ends:{" "}
            {endDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {recurringItems.length > 0 && (
            <span>
              Per cycle: {formatCurrency(perCycleTotal, currency)}
            </span>
          )}
        </div>
        {recurringItems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {recurringItems.map((li) => {
              const eff = li.overrideUnitAmount ?? li.unitAmount;
              const converted = convertPriceToFrequency(
                eff,
                li.interval,
                billingFrequency,
              );
              return (
                <Badge key={li.priceId} variant="outline" className="font-mono text-xs">
                  {li.productName}: {formatCurrency(converted, li.currency)}/
                  {BILLING_FREQUENCY_LABELS[billingFrequency].toLowerCase().replace("every ", "")}
                </Badge>
              );
            })}
          </div>
        )}
        {oneTimeItems.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            + {formatCurrency(oneTimeTotal, currency)} one-time (charged on
            first invoice)
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="eff-date">
            Subscription Effective Date{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="eff-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => onChangeEffectiveDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to start immediately upon acceptance. Future dates
            create a subscription schedule.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="trial-days">
            Trial Period{" "}
            <span className="text-muted-foreground">(days, optional)</span>
          </Label>
          <Input
            id="trial-days"
            type="number"
            min="0"
            placeholder="0"
            value={trialPeriodDays}
            onChange={(e) => onChangeTrialDays(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="exp-days">Quote Expiration (days)</Label>
        <Input
          id="exp-days"
          type="number"
          min="1"
          value={expiresInDays}
          onChange={(e) => onChangeExpiresIn(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The quote will automatically cancel if not accepted within this many
          days.
        </p>
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-5">{content}</div>;
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Contract Terms</CardTitle>
        <CardDescription>
          Set the contract length, billing frequency, and subscription dates.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {content}
      </CardContent>
      <CardFooter className="justify-between border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!isValid}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}
