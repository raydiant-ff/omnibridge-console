"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PickTerms } from "./pick-terms";
import { PickPaymentPath } from "./pick-payment-path";
import { PickLineItems } from "./pick-line-items";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";
import type { QuoteLineItem } from "@/lib/actions/quotes";

interface Props {
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveDate: string;
  trialPeriodDays: string;
  expiresInDays: string;
  lineItems: QuoteLineItem[];
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue: string;
  onChangeContractTerm: (v: ContractTerm) => void;
  onChangeBillingFrequency: (v: BillingFrequency) => void;
  onChangeEffectiveDate: (v: string) => void;
  onChangeTrialDays: (v: string) => void;
  onChangeExpiresIn: (v: string) => void;
  onChangeLineItems: (items: QuoteLineItem[]) => void;
  onChangeMethod: (v: "charge_automatically" | "send_invoice") => void;
  onChangeDays: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ConfigureQuote({
  contractTerm,
  billingFrequency,
  effectiveDate,
  trialPeriodDays,
  expiresInDays,
  lineItems,
  collectionMethod,
  daysUntilDue,
  onChangeContractTerm,
  onChangeBillingFrequency,
  onChangeEffectiveDate,
  onChangeTrialDays,
  onChangeExpiresIn,
  onChangeLineItems,
  onChangeMethod,
  onChangeDays,
  onNext,
  onBack,
}: Props) {
  const expDays = parseInt(expiresInDays, 10);
  const termsValid = !isNaN(expDays) && expDays > 0;

  const paymentMode = collectionMethod === "charge_automatically" ? "pay_now" : "send_invoice";
  const paymentValid =
    paymentMode === "pay_now" ||
    (daysUntilDue === "0" || parseInt(daysUntilDue, 10) > 0);

  const canContinue = termsValid && paymentValid && lineItems.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: Terms + Payment side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Contract Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <PickTerms
              embedded
              contractTerm={contractTerm}
              billingFrequency={billingFrequency}
              effectiveDate={effectiveDate}
              trialPeriodDays={trialPeriodDays}
              expiresInDays={expiresInDays}
              lineItems={lineItems}
              onChangeContractTerm={onChangeContractTerm}
              onChangeBillingFrequency={onChangeBillingFrequency}
              onChangeEffectiveDate={onChangeEffectiveDate}
              onChangeTrialDays={onChangeTrialDays}
              onChangeExpiresIn={onChangeExpiresIn}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Payment Path</CardTitle>
          </CardHeader>
          <CardContent>
            <PickPaymentPath
              embedded
              collectionMethod={collectionMethod}
              daysUntilDue={daysUntilDue}
              onChangeMethod={onChangeMethod}
              onChangeDays={onChangeDays}
            />
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Line Items (full width) */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <PickLineItems
            embedded
            lineItems={lineItems}
            billingFrequency={billingFrequency}
            onChange={onChangeLineItems}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
