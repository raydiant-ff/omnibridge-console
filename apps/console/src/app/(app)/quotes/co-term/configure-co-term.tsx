"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  Loader2,
  Check,
  AlertTriangle,
  Calendar,
  CreditCard,
  Zap,
  FileText,
  CalendarClock,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PickLineItems } from "../create/steps/pick-line-items";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getCustomerSubscriptions,
  type CustomerSubscription,
} from "@/lib/queries/customer-subscriptions";
import {
  billingIntervalToStripe,
  validBillingFrequencies,
  CONTRACT_TERM_LABELS,
  BILLING_FREQUENCY_LABELS,
  type ContractTerm,
  type BillingFrequency,
} from "@/lib/billing-utils";
import type { QuoteLineItem } from "@/lib/actions/quotes";
import type { EffectiveTiming } from "../create/steps/pick-timing";

interface Props {
  stripeCustomerId: string;
  selectedSubscription: CustomerSubscription | null;
  lineItems: QuoteLineItem[];
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  timing: EffectiveTiming;
  onSelectSubscription: (sub: CustomerSubscription) => void;
  onChangeContractTerm: (v: ContractTerm) => void;
  onChangeBillingFrequency: (v: BillingFrequency) => void;
  onChangeLineItems: (items: QuoteLineItem[]) => void;
  onChangeTiming: (t: EffectiveTiming) => void;
  onNext: () => void;
  onBack: () => void;
}

const TIMING_OPTIONS: {
  value: EffectiveTiming;
  label: string;
  icon: typeof Zap;
  description: string;
}[] = [
  {
    value: "immediate",
    label: "Immediately (prorated & charged now)",
    icon: Zap,
    description:
      "New products are added and the prorated amount is invoiced right away.",
  },
  {
    value: "next_invoice",
    label: "Immediately (proration on next invoice)",
    icon: FileText,
    description:
      "New products are added now, but the proration charge rolls into the next regular invoice.",
  },
  {
    value: "end_of_cycle",
    label: "At next billing cycle",
    icon: CalendarClock,
    description: "New products start at the next billing date. No proration.",
  },
];

function inferContractTerm(sub: CustomerSubscription): ContractTerm | null {
  if (sub.metadata?.contract_term) {
    return sub.metadata.contract_term as ContractTerm;
  }
  return null;
}

function renderSubCard(
  sub: CustomerSubscription,
  isSelected: boolean,
  onSelect: () => void,
) {
  const termLabel = sub.metadata?.contract_term
    ? CONTRACT_TERM_LABELS[sub.metadata.contract_term as ContractTerm] ?? sub.metadata.contract_term
    : null;

  return (
    <button
      key={sub.id}
      type="button"
      onClick={onSelect}
      className={`w-full rounded-xl border p-3 text-left transition-colors ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium">{sub.id}</span>
            <Badge
              variant={sub.status === "active" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {sub.status}
            </Badge>
            {termLabel && (
              <Badge variant="outline" className="text-[10px]">
                {termLabel}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CreditCard className="size-2.5" />
              {sub.collectionMethod === "send_invoice"
                ? "Invoice"
                : "Auto-charge"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-2.5" />
              {formatDate(sub.currentPeriodStart)} –{" "}
              {formatDate(sub.currentPeriodEnd)}
            </span>
            <span>MRR: {formatCurrency(sub.mrr, sub.currency)}</span>
          </div>
          <div className="space-y-0.5">
            {sub.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-muted-foreground">
                  {item.productName} &times; {item.quantity}
                </span>
                <span className="tabular-nums">
                  {formatCurrency(item.unitAmount, item.currency)}
                  {item.interval ? `/${item.interval}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
        {isSelected && (
          <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" />
          </div>
        )}
      </div>
    </button>
  );
}

export function ConfigureCoTerm({
  stripeCustomerId,
  selectedSubscription,
  lineItems,
  contractTerm,
  billingFrequency,
  timing,
  onSelectSubscription,
  onChangeContractTerm,
  onChangeBillingFrequency,
  onChangeLineItems,
  onChangeTiming,
  onNext,
  onBack,
}: Props) {
  const [subs, setSubs] = useState<CustomerSubscription[]>([]);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showOther, setShowOther] = useState(false);

  useEffect(() => {
    if (!stripeCustomerId || loaded) return;
    startTransition(async () => {
      try {
        const data = await getCustomerSubscriptions(stripeCustomerId);
        setSubs(data);
        setLoaded(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load subscriptions.",
        );
      }
    });
  }, [stripeCustomerId, loaded]);

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

  const eligible = subs.filter((s) => !s.cancelAtPeriodEnd && !s.cancelAt);
  const ineligible = subs.filter((s) => s.cancelAtPeriodEnd || !!s.cancelAt);

  const { interval: targetInterval, interval_count: targetCount } =
    billingIntervalToStripe(billingFrequency);

  const { matched, other } = useMemo(() => {
    const m: CustomerSubscription[] = [];
    const o: CustomerSubscription[] = [];

    for (const sub of eligible) {
      const billingMatch =
        sub.billingInterval === targetInterval &&
        sub.billingIntervalCount === targetCount;

      if (!billingMatch) {
        o.push(sub);
        continue;
      }

      const subTerm = inferContractTerm(sub);
      if (subTerm === contractTerm || subTerm === null) {
        m.push(sub);
      } else {
        o.push(sub);
      }
    }

    return { matched: m, other: o };
  }, [eligible, targetInterval, targetCount, contractTerm]);

  const canContinue = !!selectedSubscription && lineItems.length > 0;

  const selectedIsStillValid =
    selectedSubscription &&
    matched.some((s) => s.id === selectedSubscription.id);

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: Subscription picker + Timing side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: Term/Frequency selectors + Subscription list */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div>
              <h3 className="text-sm font-semibold">
                Select Subscription to Co-Term Into
              </h3>
              <p className="text-xs text-muted-foreground">
                Choose the contract term and billing frequency, then select a
                matching subscription.
              </p>
            </div>

            {/* Term + Frequency selectors */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Contract Term</Label>
                <Select
                  value={contractTerm}
                  onValueChange={(v) => handleTermChange(v as ContractTerm)}
                >
                  <SelectTrigger className="h-8 text-xs">
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

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Billing Frequency</Label>
                <Select
                  value={billingFrequency}
                  onValueChange={(v) =>
                    onChangeBillingFrequency(v as BillingFrequency)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
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

            {/* Loading / Error / Empty states */}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading subscriptions...
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {loaded && subs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <AlertTriangle className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">No active subscriptions</p>
                <p className="text-xs text-muted-foreground">
                  This customer has no active subscriptions to amend.
                </p>
              </div>
            )}

            {/* Matching subscriptions */}
            {loaded && subs.length > 0 && matched.length === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      No subscriptions match
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                      No active subscriptions match{" "}
                      <strong>{CONTRACT_TERM_LABELS[contractTerm]}</strong> /{" "}
                      <strong>{BILLING_FREQUENCY_LABELS[billingFrequency]}</strong>.
                      Try a different term or frequency.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {matched.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs font-medium text-muted-foreground">
                  Matching subscriptions ({matched.length})
                </p>
                <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto">
                  {matched.map((sub) =>
                    renderSubCard(
                      sub,
                      sub.id === selectedSubscription?.id,
                      () => onSelectSubscription(sub),
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Other (non-matching) subscriptions — collapsible, read-only */}
            {other.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowOther((v) => !v)}
                  className="flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {showOther ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  Other subscriptions ({other.length})
                </button>
                {showOther && (
                  <>
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          These subscriptions do not match the selected contract
                          term and billing frequency. They cannot be selected for
                          co-term.
                        </p>
                      </div>
                    </div>
                    <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto">
                      {other.map((sub) => (
                        <div
                          key={sub.id}
                          className="cursor-not-allowed rounded-xl border border-dashed p-3 opacity-60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-medium">
                                  {sub.id}
                                </span>
                                <Badge
                                  variant={
                                    sub.status === "active"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-[10px]"
                                >
                                  {sub.status}
                                </Badge>
                                {sub.metadata?.contract_term && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {CONTRACT_TERM_LABELS[
                                      sub.metadata.contract_term as ContractTerm
                                    ] ?? sub.metadata.contract_term}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CreditCard className="size-2.5" />
                                  {sub.collectionMethod === "send_invoice"
                                    ? "Invoice"
                                    : "Auto-charge"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="size-2.5" />
                                  {formatDate(sub.currentPeriodStart)} –{" "}
                                  {formatDate(sub.currentPeriodEnd)}
                                </span>
                                <span>
                                  MRR: {formatCurrency(sub.mrr, sub.currency)}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                {sub.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between text-[11px]"
                                  >
                                    <span className="text-muted-foreground">
                                      {item.productName} &times; {item.quantity}
                                    </span>
                                    <span className="tabular-nums">
                                      {formatCurrency(
                                        item.unitAmount,
                                        item.currency,
                                      )}
                                      {item.interval ? `/${item.interval}` : ""}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Ineligible */}
            {ineligible.length > 0 && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-xs font-medium text-muted-foreground">
                  Ineligible (pending cancellation)
                </p>
                {ineligible.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-xl border border-dashed p-2 opacity-50"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono">{sub.id}</span>
                      <Badge variant="destructive" className="text-[10px]">
                        Cancelling
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Warning if selection no longer matches */}
            {selectedSubscription && !selectedIsStillValid && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Your previously selected subscription no longer matches the
                  current filters. Please select a new one.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Timing */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div>
              <h3 className="text-sm font-semibold">Effective Timing</h3>
              <p className="text-xs text-muted-foreground">
                When should the new products take effect?
              </p>
            </div>

            {selectedSubscription && selectedIsStillValid && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Next billing:{" "}
                    <strong>
                      {new Date(
                        selectedSubscription.currentPeriodEnd,
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {TIMING_OPTIONS.map(
                ({ value, label, icon: Icon, description }) => {
                  const isSelected = timing === value;
                  const disabled = !selectedSubscription || !selectedIsStillValid;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onChangeTiming(value)}
                      disabled={disabled}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        disabled
                          ? "cursor-not-allowed opacity-50"
                          : isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="size-3" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium">{label}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Line Items (full width) */}
      <Card>
        <CardContent className="pt-6">
          <PickLineItems
            embedded
            lineItems={lineItems}
            billingFrequency={billingFrequency}
            onChange={onChangeLineItems}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!canContinue || !selectedIsStillValid}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
