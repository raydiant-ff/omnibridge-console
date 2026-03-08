"use client";

import { useState, useCallback } from "react";
import { PickCustomer } from "./steps/pick-customer";
import { PickPrices } from "./steps/pick-prices";
import { PickDates } from "./steps/pick-dates";
import { PickBilling } from "./steps/pick-billing";
import { Review } from "./steps/review";
import { Success } from "./steps/success";
import type { LineItem, CreateSubscriptionResult } from "@/lib/actions/create-subscription";

const STEP_LABELS = [
  "Customer",
  "Prices",
  "Dates",
  "Billing",
  "Review",
] as const;

export interface WizardCustomer {
  id: string;
  sfAccountName: string | null;
  stripeCustomerId: string | null;
  domain: string | null;
}

export interface WizardState {
  customer: WizardCustomer | null;
  lineItems: LineItem[];
  startDate: string;
  endDate: string;
  billingMode: "now" | "future";
  billingDate: string;
  idempotencyKey: string;
}

function generateIdempotencyKey() {
  return `csub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function Wizard() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<CreateSubscriptionResult | null>(null);

  const [state, setState] = useState<WizardState>({
    customer: null,
    lineItems: [],
    startDate: "",
    endDate: "",
    billingMode: "now",
    billingDate: "",
    idempotencyKey: generateIdempotencyKey(),
  });

  const update = useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 4)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  if (result?.success) {
    return <Success result={result} state={state} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <nav aria-label="Wizard progress" className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`mx-1 h-px w-6 ${i <= step ? "bg-foreground" : "bg-border"}`}
              />
            )}
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-default"
              }`}
            >
              <span>{i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        ))}
      </nav>

      {/* Step content */}
      {step === 0 && (
        <PickCustomer
          selected={state.customer}
          onSelect={(c) => { update("customer", c); next(); }}
        />
      )}
      {step === 1 && (
        <PickPrices
          lineItems={state.lineItems}
          onChange={(items) => update("lineItems", items)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && (
        <PickDates
          startDate={state.startDate}
          endDate={state.endDate}
          onChangeStart={(v) => update("startDate", v)}
          onChangeEnd={(v) => update("endDate", v)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 3 && (
        <PickBilling
          billingMode={state.billingMode}
          billingDate={state.billingDate}
          onChangeMode={(v) => update("billingMode", v)}
          onChangeDate={(v) => update("billingDate", v)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <Review
          state={state}
          onBack={back}
          onResult={setResult}
        />
      )}
    </div>
  );
}
