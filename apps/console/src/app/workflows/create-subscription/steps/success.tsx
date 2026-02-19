"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import type { CreateSubscriptionResult } from "@/lib/actions/create-subscription";
import type { WizardState } from "../wizard";

interface Props {
  result: CreateSubscriptionResult;
  state: WizardState;
}

export function Success({ result, state }: Props) {
  const isMock = result.stripeScheduleId?.includes("mock") ?? false;
  const dashboardBase = "https://dashboard.stripe.com";

  const totalRecurring = state.lineItems.reduce(
    (acc, li) => acc + li.unitAmount * li.quantity,
    0,
  );

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 pt-8 pb-8">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">
            Subscription Created
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.customer?.sfAccountName} — {state.lineItems.length} line item
            {state.lineItems.length !== 1 ? "s" : ""} totaling{" "}
            {formatCurrency(totalRecurring, state.lineItems[0]?.currency ?? "usd")}/
            {state.lineItems[0]?.interval ?? "month"}
          </p>
        </div>

        {isMock && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Mock mode — no real Stripe objects were created.
          </div>
        )}

        <div className="w-full max-w-md space-y-3">
          {result.stripeScheduleId && (
            <ResourceLink
              label="Subscription Schedule"
              id={result.stripeScheduleId}
              href={
                isMock
                  ? undefined
                  : `${dashboardBase}/subscription_schedules/${result.stripeScheduleId}`
              }
            />
          )}
          {result.stripeSubscriptionId && (
            <ResourceLink
              label="Subscription"
              id={result.stripeSubscriptionId}
              href={
                isMock
                  ? undefined
                  : `${dashboardBase}/subscriptions/${result.stripeSubscriptionId}`
              }
            />
          )}
          {result.workItemId && (
            <ResourceLink label="Work Item" id={result.workItemId} />
          )}
          {result.auditLogId && (
            <ResourceLink label="Audit Log" id={result.auditLogId} />
          )}
        </div>

        <Separator />

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href={`/customers/${state.customer?.id}`}>
              View Customer
            </Link>
          </Button>
          <Button asChild>
            <Link href="/workflows/create-subscription">
              Create Another
            </Link>
          </Button>
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
        <span className="text-sm font-mono">{id}</span>
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
