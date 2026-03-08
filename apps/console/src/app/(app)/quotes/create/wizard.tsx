"use client";

import { useState, useCallback, useEffect } from "react";
import { PickCustomer } from "./steps/pick-customer";
import { PickBillToContact } from "./steps/pick-bill-to-contact";
import { PickLineItems } from "./steps/pick-line-items";
import { PickTerms } from "./steps/pick-terms";
import { PickPaymentPath } from "./steps/pick-payment-path";
import { ReviewQuote } from "./steps/review-quote";
import { PandaDocPreview } from "./steps/pandadoc-preview";
import { QuoteSuccess } from "./steps/quote-success";
import { cancelQuote } from "@/lib/actions/quotes";
import type { QuoteLineItem, CreateQuoteResult } from "@/lib/actions/quotes";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";

const STEP_LABELS = [
  "Customer",
  "Bill-To Contact",
  "Terms",
  "Line Items",
  "Payment",
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
  } catch { /* storage full or unavailable */ }
}

function clearSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* noop */ }
}

const DEFAULT_STATE: QuoteWizardState = {
  customer: null,
  opportunityId: "",
  billToContactId: "",
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
};

export function QuoteWizard() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<CreateQuoteResult | null>(null);
  const [docSent, setDocSent] = useState(false);
  const [state, setState] = useState<QuoteWizardState>(DEFAULT_STATE);
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
    <K extends keyof QuoteWizardState>(key: K, value: QuoteWizardState[K]) => {
      setState((prev) => ({
        ...prev,
        [key]: value,
        idempotencyKey: key === "dryRun" ? prev.idempotencyKey : generateIdempotencyKey(),
      }));
    },
    [],
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 5)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  function handleQuoteResult(r: CreateQuoteResult) {
    setResult(r);
    setStep(5);
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

  if (docSent && result?.success) {
    return <QuoteSuccess result={result} state={state} onStartNew={handleStartNew} />;
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
          selected={state.customer}
          opportunityId={state.opportunityId}
          onSelect={(c) => update("customer", c as QuoteWizardState["customer"])}
          onOpportunityChange={(v) => update("opportunityId", v)}
          onNext={next}
        />
      )}
      {step === 1 && (
        <PickBillToContact
          sfAccountId={state.customer?.sfAccountId || ""}
          billToContactId={state.billToContactId}
          onChange={(contactId) => update("billToContactId", contactId)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && (
        <PickTerms
          contractTerm={state.contractTerm}
          billingFrequency={state.billingFrequency}
          effectiveDate={state.effectiveDate}
          trialPeriodDays={state.trialPeriodDays}
          expiresInDays={state.expiresInDays}
          lineItems={state.lineItems}
          onChangeContractTerm={(v) => update("contractTerm", v)}
          onChangeBillingFrequency={(v) => update("billingFrequency", v)}
          onChangeEffectiveDate={(v) => update("effectiveDate", v)}
          onChangeTrialDays={(v) => update("trialPeriodDays", v)}
          onChangeExpiresIn={(v) => update("expiresInDays", v)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 3 && (
        <PickLineItems
          lineItems={state.lineItems}
          billingFrequency={state.billingFrequency}
          onChange={(items) => update("lineItems", items)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <PickPaymentPath
          collectionMethod={state.collectionMethod}
          daysUntilDue={state.daysUntilDue}
          onChangeMethod={(v) => update("collectionMethod", v)}
          onChangeDays={(v) => update("daysUntilDue", v)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 5 && (
        <ReviewQuote
          state={state}
          onBack={back}
          onResult={handleQuoteResult}
          onToggleDryRun={(v) => update("dryRun", v)}
        />
      )}
      {step === 6 && result && (
        <PandaDocPreview
          result={result}
          onSent={handleDocSent}
          onBack={async () => {
            if (result.quoteRecordId && !result.dryRun) {
              await cancelQuote(result.quoteRecordId);
            }
            setResult(null);
            setState((prev) => ({ ...prev, idempotencyKey: generateIdempotencyKey() }));
            setStep(4);
          }}
        />
      )}
    </div>
  );
}
