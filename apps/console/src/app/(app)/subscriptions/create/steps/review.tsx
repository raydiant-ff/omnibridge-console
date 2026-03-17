"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ReviewPanel, ReviewRow } from "@/components/omni/review-panel";
import { formatCurrency } from "@/lib/format";
import {
  executeCreateSubscription,
  type CreateSubscriptionResult,
} from "@/lib/actions/create-subscription";
import type { WizardState } from "../wizard";

interface Props {
  state: WizardState;
  onBack: () => void;
  onResult: (result: CreateSubscriptionResult) => void;
}

export function Review({ state, onBack, onResult }: Props) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalMonthly = state.lineItems.reduce(
    (acc, li) => acc + li.unitAmount * li.quantity,
    0,
  );

  async function handleExecute() {
    if (!state.customer?.stripeCustomerId) return;
    setIsExecuting(true);
    setError(null);

    try {
      const result = await executeCreateSubscription({
        customerId: state.customer.id,
        stripeCustomerId: state.customer.stripeCustomerId,
        customerName: state.customer.sfAccountName ?? "Unknown",
        lineItems: state.lineItems,
        startDate: state.startDate,
        endDate: state.endDate,
        billingMode: state.billingMode,
        billingDate: state.billingMode === "future" ? state.billingDate : undefined,
        idempotencyKey: state.idempotencyKey,
      });

      if (!result.success) {
        setError(result.error ?? "Unknown error");
        setIsExecuting(false);
        return;
      }

      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsExecuting(false);
    }
  }

  const start = new Date(state.startDate);
  const end = new Date(state.endDate);

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">Review &amp; Confirm</h2>
        <p className="text-sm text-muted-foreground">
          Verify everything below, then execute to create the subscription.
        </p>
      </div>

      {/* Customer */}
      <ReviewPanel title="Customer">
        <ReviewRow label="Account" value={state.customer?.sfAccountName ?? "—"} />
        <ReviewRow label="Stripe ID" value={state.customer?.stripeCustomerId ?? "—"} mono />
        <ReviewRow label="Domain" value={state.customer?.domain ?? "—"} />
      </ReviewPanel>

      {/* Prices */}
      <ReviewPanel
        title="Prices"
        footer={
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total recurring</span>
            <span className="text-sm font-bold tabular-nums">
              {formatCurrency(totalMonthly, state.lineItems[0]?.currency ?? "usd")}/
              {state.lineItems[0]?.interval ?? "month"}
            </span>
          </div>
        }
      >
        {state.lineItems.map((li) => (
          <div key={li.priceId} className="flex items-center justify-between py-1.5">
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium">{li.nickname}</span>
              <span className="text-xs text-muted-foreground font-mono">{li.priceId}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Badge variant="outline">x{li.quantity}</Badge>
              <span className="font-medium tabular-nums">
                {formatCurrency(li.unitAmount * li.quantity, li.currency)}/{li.interval}
              </span>
            </div>
          </div>
        ))}
      </ReviewPanel>

      {/* Period */}
      <ReviewPanel title="Period">
        <ReviewRow label="Start" value={formatDT(start)} />
        <ReviewRow label="End" value={formatDT(end)} />
        {start < new Date() && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 mt-1">
            <AlertTriangle className="size-3" />
            Backdated — start date is in the past.
          </div>
        )}
      </ReviewPanel>

      {/* Billing */}
      <ReviewPanel title="Billing">
        {state.billingMode === "now" ? (
          <ReviewRow label="Invoice timing" value="Bill immediately on start" />
        ) : (
          <>
            <ReviewRow label="Invoice timing" value="Deferred billing" />
            <ReviewRow label="First invoice date" value={formatDT(new Date(state.billingDate))} />
          </>
        )}
      </ReviewPanel>

      {/* Idempotency */}
      <div className="rounded-xl bg-muted/50 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          Idempotency key:{" "}
          <code className="font-mono">{state.idempotencyKey}</code>
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Safe to retry — duplicate submissions will return the same result.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack} disabled={isExecuting}>
          Back
        </Button>
        <Button onClick={handleExecute} disabled={isExecuting}>
          {isExecuting ? (
            <>
              <Loader2 className="animate-spin" />
              Creating…
            </>
          ) : (
            "Execute"
          )}
        </Button>
      </div>
    </div>
  );
}

function formatDT(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
