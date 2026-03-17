"use client";

import { Zap, CalendarClock, FileText, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EffectiveTiming = "immediate" | "next_invoice" | "end_of_cycle";

interface Props {
  timing: EffectiveTiming;
  nextBillingDate: string;
  onChange: (t: EffectiveTiming) => void;
  onNext: () => void;
  onBack: () => void;
}

const OPTIONS: {
  value: EffectiveTiming;
  label: string;
  icon: typeof Zap;
  description: string;
  detail: string;
}[] = [
  {
    value: "immediate",
    label: "Immediately (prorated & charged now)",
    icon: Zap,
    description: "New products are added and the prorated amount is invoiced right away.",
    detail:
      "Stripe will generate a separate prorated invoice for the partial period and charge it immediately. Use this when the customer expects an instant charge.",
  },
  {
    value: "next_invoice",
    label: "Immediately (proration on next invoice)",
    icon: FileText,
    description: "New products are added now, but the proration charge rolls into the next regular invoice.",
    detail:
      "Products activate immediately. The prorated amount is added as a pending line item and collected on the next scheduled invoice. Ideal for customers with third-party AP systems that expect charges on regular billing cycles.",
  },
  {
    value: "end_of_cycle",
    label: "At next billing cycle",
    icon: CalendarClock,
    description: "New products start at the next billing date.",
    detail:
      "No proration is charged. The new items will appear on the subscription starting from the next billing cycle and be included in the regular invoice.",
  },
];

export function PickTiming({
  timing,
  nextBillingDate,
  onChange,
  onNext,
  onBack,
}: Props) {
  const formattedDate = new Date(nextBillingDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">When should the new products take effect?</h2>
        <p className="text-sm text-muted-foreground">
          Choose when the added products should be activated on the subscription.
        </p>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Next billing date for this subscription: <strong>{formattedDate}</strong>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {OPTIONS.map(({ value, label, icon: Icon, description, detail }) => {
          const selected = timing === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={`w-full rounded-xl border p-4 text-left transition-colors ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  {selected && (
                    <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
                      {detail}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
