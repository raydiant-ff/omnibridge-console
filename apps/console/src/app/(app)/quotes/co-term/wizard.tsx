"use client";

import { useState, useCallback, useEffect } from "react";
import { PickCustomer } from "../create/steps/pick-customer";
import { ConfigureCoTerm } from "./configure-co-term";
import { ReviewCoTerm } from "./review-co-term";
import { DocumentPreview } from "../create/steps/document-preview";
import { QuoteSuccess } from "../create/steps/quote-success";
import type { QuoteLineItem, CreateQuoteResult } from "@/lib/actions/quotes";
import type { CustomerSubscription } from "@/lib/queries/customer-subscriptions";
import type { ExistingSubItem } from "@/lib/actions/co-term-quote";
import type { EffectiveTiming } from "../create/steps/pick-timing";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";

const STEP_LABELS = [
  "Customer",
  "Configure",
  "Review",
  "Preview",
] as const;

const STORAGE_KEY = "co-term-wizard-session";

export interface CoTermCustomer {
  id: string;
  sfAccountId: string | null;
  sfAccountName: string | null;
  stripeCustomerId: string | null;
  domain: string | null;
}

export interface CoTermWizardState {
  customer: CoTermCustomer | null;
  opportunityId: string;
  billToContactId: string;
  selectedSubscription: CustomerSubscription | null;
  existingItems: ExistingSubItem[];
  lineItems: QuoteLineItem[];
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveTiming: EffectiveTiming;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue: string;
  expiresInDays: string;
  idempotencyKey: string;
  dryRun: boolean;
}

interface PersistedSession {
  step: number;
  state: CoTermWizardState;
  result: CreateQuoteResult | null;
  docSent: boolean;
}

function generateIdempotencyKey() {
  return `cqt_ct_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function saveSession(session: PersistedSession) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch { /* noop */ }
}

function clearSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* noop */ }
}

const DEFAULT_STATE: CoTermWizardState = {
  customer: null,
  opportunityId: "",
  billToContactId: "",
  selectedSubscription: null,
  existingItems: [],
  lineItems: [],
  contractTerm: "1yr",
  billingFrequency: "monthly",
  effectiveTiming: "immediate",
  collectionMethod: "charge_automatically",
  daysUntilDue: "30",
  expiresInDays: "30",
  idempotencyKey: generateIdempotencyKey(),
  dryRun: true,
};

function deriveBillingFrequency(sub: CustomerSubscription): BillingFrequency {
  const interval = sub.billingInterval;
  const count = sub.billingIntervalCount;
  if (interval === "month") {
    if (count === 1) return "monthly";
    if (count === 3) return "quarterly";
    if (count === 6) return "semi_annual";
  }
  if (interval === "year") {
    if (count === 1) return "annual";
    if (count === 2) return "2yr";
    if (count === 3) return "3yr";
  }
  return "monthly";
}

export function CoTermWizard() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<CreateQuoteResult | null>(null);
  const [docSent, setDocSent] = useState(false);
  const [state, setState] = useState<CoTermWizardState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setStep(saved.step);
      setResult(saved.result);
      setDocSent(saved.docSent);
      setState(saved.state);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSession({ step, state, result, docSent });
  }, [step, state, result, docSent, hydrated]);

  const update = useCallback(
    <K extends keyof CoTermWizardState>(key: K, value: CoTermWizardState[K]) => {
      setState((prev) => ({
        ...prev,
        [key]: value,
        idempotencyKey: key === "dryRun" ? prev.idempotencyKey : generateIdempotencyKey(),
      }));
    },
    [],
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  function handleSubscriptionSelect(sub: CustomerSubscription) {
    const existing: ExistingSubItem[] = sub.items.map((item) => ({
      subscriptionItemId: item.id,
      priceId: item.priceId,
      productName: item.productName,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      interval: item.interval,
      intervalCount: item.intervalCount,
    }));

    setState((prev) => ({
      ...prev,
      selectedSubscription: sub,
      existingItems: existing,
      billingFrequency: deriveBillingFrequency(sub),
      collectionMethod: sub.collectionMethod as "charge_automatically" | "send_invoice",
      idempotencyKey: generateIdempotencyKey(),
    }));
  }

  function handleQuoteResult(r: CreateQuoteResult) {
    setResult(r);
    setStep(3);
  }

  function handleDocSent() {
    setDocSent(true);
    clearSession();
  }

  function handleStartNew() {
    clearSession();
    setStep(0);
    setResult(null);
    setDocSent(false);
    setState({ ...DEFAULT_STATE, idempotencyKey: generateIdempotencyKey() });
  }

  if (!hydrated) return null;

  if (docSent && result?.success) {
    return <QuoteSuccess result={result} state={state as any} onStartNew={handleStartNew} />;
  }

  return (
    <div className="flex flex-col gap-6">
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
        {step > 0 && (
          <button
            type="button"
            onClick={handleStartNew}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Start Over
          </button>
        )}
      </nav>

      {step === 0 && (
        <PickCustomer
          quoteType="Expansion"
          selected={state.customer}
          opportunityId={state.opportunityId}
          billToContactId={state.billToContactId}
          contractMode="co_term"
          onSelect={(c) => update("customer", c as CoTermWizardState["customer"])}
          onOpportunityChange={(v) => update("opportunityId", v)}
          onBillToContactChange={(v) => update("billToContactId", v)}
          onContractModeChange={() => {/* co-term wizard is always co_term */}}
          onNext={next}
        />
      )}
      {step === 1 && state.customer?.stripeCustomerId && (
        <ConfigureCoTerm
          stripeCustomerId={state.customer.stripeCustomerId}
          selectedSubscription={state.selectedSubscription}
          lineItems={state.lineItems}
          contractTerm={state.contractTerm}
          billingFrequency={state.billingFrequency}
          timing={state.effectiveTiming}
          onSelectSubscription={handleSubscriptionSelect}
          onChangeContractTerm={(v) => update("contractTerm", v)}
          onChangeBillingFrequency={(v) => update("billingFrequency", v)}
          onChangeLineItems={(items) => update("lineItems", items)}
          onChangeTiming={(t) => update("effectiveTiming", t)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && (
        <ReviewCoTerm
          state={state}
          onBack={back}
          onResult={handleQuoteResult}
          onToggleDryRun={(v) => update("dryRun", v)}
        />
      )}
      {step === 3 && result && (
        <DocumentPreview
          result={result}
          onSent={handleDocSent}
          onBack={async () => {
            setResult(null);
            setState((prev) => ({ ...prev, idempotencyKey: generateIdempotencyKey() }));
            setStep(2);
          }}
        />
      )}
    </div>
  );
}
