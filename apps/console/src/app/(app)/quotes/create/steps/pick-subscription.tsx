"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2, Check, AlertTriangle, Calendar, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getCustomerSubscriptions,
  type CustomerSubscription,
} from "@/lib/queries/customer-subscriptions";

interface Props {
  stripeCustomerId: string;
  selectedSubscriptionId: string | null;
  onSelect: (sub: CustomerSubscription) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PickSubscription({
  stripeCustomerId,
  selectedSubscriptionId,
  onSelect,
  onNext,
  onBack,
}: Props) {
  const [subs, setSubs] = useState<CustomerSubscription[]>([]);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!stripeCustomerId || loaded) return;
    startTransition(async () => {
      try {
        const data = await getCustomerSubscriptions(stripeCustomerId);
        setSubs(data);
        setLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load subscriptions.");
      }
    });
  }, [stripeCustomerId, loaded]);

  const eligible = subs.filter(
    (s) => !s.cancelAtPeriodEnd && !s.cancelAt,
  );
  const ineligible = subs.filter(
    (s) => s.cancelAtPeriodEnd || !!s.cancelAt,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Select Subscription</h2>
        <p className="text-sm text-muted-foreground">
          Choose the active subscription you want to add products to.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading subscriptions...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loaded && subs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertTriangle className="size-8 text-muted-foreground" />
            <p className="font-medium">No active subscriptions found</p>
            <p className="text-sm text-muted-foreground">
              This customer has no active or trialing subscriptions to amend.
            </p>
          </CardContent>
        </Card>
      )}

      {eligible.length > 0 && (
        <div className="flex flex-col gap-3">
          {eligible.map((sub) => {
            const selected = sub.id === selectedSubscriptionId;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelect(sub)}
                className={`w-full rounded-xl border p-4 text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm font-mono">{sub.id}</span>
                      <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                        {sub.status}
                      </Badge>
                      {sub.scheduleId && (
                        <Badge variant="outline" className="text-xs">
                          Schedule
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CreditCard className="size-3" />
                        {sub.collectionMethod === "send_invoice" ? "Invoice" : "Auto-charge"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        Period: {formatDate(sub.currentPeriodStart)} – {formatDate(sub.currentPeriodEnd)}
                      </span>
                      <span>
                        MRR: {formatCurrency(sub.mrr, sub.currency)}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {sub.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {item.productName} &times; {item.quantity}
                          </span>
                          <span>
                            {formatCurrency(item.unitAmount, item.currency)}
                            {item.interval ? `/${item.interval}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selected && (
                    <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {ineligible.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">
            Ineligible (pending cancellation)
          </p>
          {ineligible.map((sub) => (
            <div
              key={sub.id}
              className="rounded-xl border border-dashed p-3 opacity-60"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs">{sub.id}</span>
                <Badge variant="destructive">Cancelling</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cannot add products to a subscription pending cancellation.
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!selectedSubscriptionId}>
          Continue
        </Button>
      </div>
    </div>
  );
}
