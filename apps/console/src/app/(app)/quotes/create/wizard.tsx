"use client";

import { useState, useCallback, useEffect } from "react";
import { PickCustomer } from "./steps/pick-customer";
import { ConfigureQuote } from "./steps/configure-quote";
import { ConfigureCoTerm } from "../co-term/configure-co-term";
import { ReviewQuote } from "./steps/review-quote";
import { ReviewCoTerm } from "../co-term/review-co-term";
import { DocumentPreview } from "./steps/document-preview";
import { QuoteSuccess } from "./steps/quote-success";
import { cancelQuote } from "@/lib/actions/quotes";
import type { QuoteLineItem, CreateQuoteResult } from "@/lib/actions/quotes";
import type { CustomerSubscription } from "@/lib/queries/customer-subscriptions";
import type { ExistingSubItem } from "@/lib/actions/co-term-quote";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";
import type { EffectiveTiming } from "./steps/pick-timing";

export type QuoteType = "New" | "Expansion" | "Renewal" | "Amendment";
export type ContractMode = "new_contract" | "co_term";

const STEP_LABELS = [
  "Customer",
  "Configure",
  "Review",
  "Preview",
] as const;

const STORAGE_KEY = "quote-wizard-session";

export interface QuoteCustomer {
  id: string;
  sfAccountId: string | null;
  sfAccountName: string | null;
  stripeCustomerId: string | null;
  domain: string | null;
}

export interface QuoteWizardState {
  customer: QuoteCustomer | null;
  opportunityId: string;
  billToContactId: string;
  contractMode: ContractMode;
  lineItems: QuoteLineItem[];
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveDate: string;
  trialPeriodDays: string;
  expiresInDays: string;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue: string;
  idempotencyKey: string;
  dryRun: boolean;
  // Co-term specific fields (only used when contractMode === "co_term")
  selectedSubscription: CustomerSubscription | null;
  existingItems: ExistingSubItem[];
  effectiveTiming: EffectiveTiming;
}

interface PersistedSession {
  step: number;
  state: QuoteWizardState;
  result: CreateQuoteResult | null;
  docSent: boolean;
}

function generateIdempotencyKey() {
  return `cqt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadSessionByKey(key: string): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function saveSessionByKey(key: string, session: PersistedSession) {
  try {
    sessionStorage.setItem(key, JSON.stringify(session));
  } catch { /* storage full or unavailable */ }
}

function clearSessionByKey(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch { /* noop */ }
}

const DEFAULT_STATE: QuoteWizardState = {
  customer: null,
  opportunityId: "",
  billToContactId: "",
  contractMode: "new_contract",
  lineItems: [],
  contractTerm: "1yr",
  billingFrequency: "monthly",
  effectiveDate: "",
  trialPeriodDays: "",
  expiresInDays: "30",
  collectionMethod: "charge_automatically",
  daysUntilDue: "30",
  idempotencyKey: generateIdempotencyKey(),
  dryRun: true,
  selectedSubscription: null,
  existingItems: [],
  effectiveTiming: "immediate",
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

export interface QuoteWizardProps {
  quoteType?: QuoteType;
  initialState?: Partial<QuoteWizardState>;
  initialStep?: number;
  storageKey?: string;
  badge?: React.ReactNode;
}

export function QuoteWizard({
  quoteType = "New",
  initialState,
  initialStep = 0,
  storageKey = STORAGE_KEY,
  badge,
}: QuoteWizardProps = {}) {
  const mergedDefault: QuoteWizardState = initialState
    ? { ...DEFAULT_STATE, ...initialState, idempotencyKey: generateIdempotencyKey() }
    : DEFAULT_STATE;

  const [step, setStep] = useState(initialStep);
  const [result, setResult] = useState<CreateQuoteResult | null>(null);
  const [docSent, setDocSent] = useState(false);
  const [state, setState] = useState<QuoteWizardState>(mergedDefault);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadSessionByKey(storageKey);
    if (saved) {
      setStep(saved.step);
      setResult(saved.result);
      setDocSent(saved.docSent);
      setState(saved.state);
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    saveSessionByKey(storageKey, { step, state, result, docSent });
  }, [step, state, result, docSent, hydrated, storageKey]);

  const update = useCallback(
    <K extends keyof QuoteWizardState>(key: K, value: QuoteWizardState[K]) => {
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

  const isCoTerm = state.contractMode === "co_term";

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
    clearSessionByKey(storageKey);
  }

  function handleStartNew() {
    clearSessionByKey(storageKey);
    setStep(initialStep);
    setResult(null);
    setDocSent(false);
    setState({ ...mergedDefault, idempotencyKey: generateIdempotencyKey() });
  }

  if (docSent && result?.success) {
    return <QuoteSuccess result={result} state={state} onStartNew={handleStartNew} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Wizard progress" className="flex items-center gap-1">
        {badge}
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
          quoteType={quoteType}
          selected={state.customer}
          opportunityId={state.opportunityId}
          billToContactId={state.billToContactId}
          contractMode={state.contractMode}
          onSelect={(c) => update("customer", c as QuoteWizardState["customer"])}
          onOpportunityChange={(v) => update("opportunityId", v)}
          onBillToContactChange={(v) => update("billToContactId", v)}
          onContractModeChange={(v) => update("contractMode", v)}
          onNext={next}
        />
      )}
      {step === 1 && !isCoTerm && (
        <ConfigureQuote
          contractTerm={state.contractTerm}
          billingFrequency={state.billingFrequency}
          effectiveDate={state.effectiveDate}
          trialPeriodDays={state.trialPeriodDays}
          expiresInDays={state.expiresInDays}
          lineItems={state.lineItems}
          collectionMethod={state.collectionMethod}
          daysUntilDue={state.daysUntilDue}
          onChangeContractTerm={(v) => update("contractTerm", v)}
          onChangeBillingFrequency={(v) => update("billingFrequency", v)}
          onChangeEffectiveDate={(v) => update("effectiveDate", v)}
          onChangeTrialDays={(v) => update("trialPeriodDays", v)}
          onChangeExpiresIn={(v) => update("expiresInDays", v)}
          onChangeLineItems={(items) => update("lineItems", items)}
          onChangeMethod={(v) => update("collectionMethod", v)}
          onChangeDays={(v) => update("daysUntilDue", v)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 1 && isCoTerm && state.customer?.stripeCustomerId && (
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
      {step === 2 && !isCoTerm && (
        <ReviewQuote
          state={state}
          onBack={back}
          onResult={handleQuoteResult}
          onToggleDryRun={(v) => update("dryRun", v)}
        />
      )}
      {step === 2 && isCoTerm && (
        <ReviewCoTerm
          state={{
            customer: state.customer as any,
            opportunityId: state.opportunityId,
            billToContactId: state.billToContactId,
            selectedSubscription: state.selectedSubscription,
            existingItems: state.existingItems,
            lineItems: state.lineItems,
            contractTerm: state.contractTerm,
            billingFrequency: state.billingFrequency,
            effectiveTiming: state.effectiveTiming,
            collectionMethod: state.collectionMethod,
            daysUntilDue: state.daysUntilDue,
            expiresInDays: state.expiresInDays,
            idempotencyKey: state.idempotencyKey,
            dryRun: state.dryRun,
          }}
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
            if (result.quoteRecordId && !result.dryRun) {
              await cancelQuote(result.quoteRecordId);
            }
            setResult(null);
            setState((prev) => ({ ...prev, idempotencyKey: generateIdempotencyKey() }));
            setStep(2);
          }}
        />
      )}
    </div>
  );
}
