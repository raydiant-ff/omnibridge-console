"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CreditCard, FileText } from "lucide-react";

type PaymentMode = "pay_now" | "send_invoice";
type InvoiceTerms = "due_on_receipt" | "net_terms";

interface Props {
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue: string;
  onChangeMethod: (v: "charge_automatically" | "send_invoice") => void;
  onChangeDays: (v: string) => void;
  onNext?: () => void;
  onBack?: () => void;
  embedded?: boolean;
}

const NET_TERM_OPTIONS = [
  { value: "15", label: "Net 15" },
  { value: "30", label: "Net 30" },
  { value: "45", label: "Net 45" },
  { value: "60", label: "Net 60" },
  { value: "90", label: "Net 90" },
  { value: "custom", label: "Custom" },
];

function deriveMode(method: "charge_automatically" | "send_invoice"): PaymentMode {
  return method === "charge_automatically" ? "pay_now" : "send_invoice";
}

function deriveInvoiceTerms(days: string): InvoiceTerms {
  return days === "0" ? "due_on_receipt" : "net_terms";
}

export function PickPaymentPath({
  collectionMethod,
  daysUntilDue,
  onChangeMethod,
  onChangeDays,
  onNext,
  onBack,
  embedded,
}: Props) {
  const mode = deriveMode(collectionMethod);
  const invoiceTerms = deriveInvoiceTerms(daysUntilDue);

  const isCustomDays =
    mode === "send_invoice" &&
    invoiceTerms === "net_terms" &&
    !["15", "30", "45", "60", "90"].includes(daysUntilDue);
  const selectValue = isCustomDays ? "custom" : daysUntilDue === "0" ? "30" : daysUntilDue;

  function handleModeChange(v: PaymentMode) {
    if (v === "pay_now") {
      onChangeMethod("charge_automatically");
      onChangeDays("30");
    } else {
      onChangeMethod("send_invoice");
      if (daysUntilDue === "0" || collectionMethod === "charge_automatically") {
        onChangeDays("0");
      }
    }
  }

  function handleInvoiceTermsChange(v: InvoiceTerms) {
    if (v === "due_on_receipt") {
      onChangeDays("0");
    } else {
      onChangeDays("30");
    }
  }

  const isValid =
    mode === "pay_now" ||
    (mode === "send_invoice" &&
      (invoiceTerms === "due_on_receipt" ||
        (invoiceTerms === "net_terms" && parseInt(daysUntilDue, 10) > 0)));

  const content = (
    <>
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold">Payment Path</h2>
          <p className="text-sm text-muted-foreground">
            Choose how the customer will pay when they accept the quote.
          </p>
        </div>
      )}

      <RadioGroup
        value={mode}
        onValueChange={(v) => handleModeChange(v as PaymentMode)}
        className="space-y-3"
      >
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
            mode === "pay_now"
              ? "border-primary bg-primary/5"
              : "hover:bg-muted/50"
          }`}
        >
          <RadioGroupItem value="pay_now" className="mt-0.5" />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <CreditCard className="size-4" />
              <span className="text-sm font-medium">Pay Now</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Customer pays at the time of signature via a Stripe Checkout
              link. Payment is collected before the subscription starts.
              Best for SMB and self-serve deals.
            </span>
          </div>
        </label>

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
            mode === "send_invoice"
              ? "border-primary bg-primary/5"
              : "hover:bg-muted/50"
          }`}
        >
          <RadioGroupItem value="send_invoice" className="mt-0.5" />
          <div className="flex flex-1 flex-col gap-1">
            <div className="flex items-center gap-2">
              <FileText className="size-4" />
              <span className="text-sm font-medium">Send Invoice</span>
            </div>
            <span className="text-xs text-muted-foreground">
              Customer receives an invoice after accepting the quote. No
              payment method required upfront. Best for mid-market and
              enterprise deals with procurement / AP processes.
            </span>
          </div>
        </label>
      </RadioGroup>

      {mode === "send_invoice" && (
        <div className="flex flex-col gap-4 rounded-lg border bg-muted/30 p-4">
          <div>
            <Label className="text-sm font-medium">Invoice Terms</Label>
            <p className="text-xs text-muted-foreground">
              When is the invoice due?
            </p>
          </div>

          <RadioGroup
            value={invoiceTerms}
            onValueChange={(v) => handleInvoiceTermsChange(v as InvoiceTerms)}
            className="space-y-2"
          >
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                invoiceTerms === "due_on_receipt"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value="due_on_receipt" />
              <span className="text-sm">Due on Receipt</span>
            </label>
            <label
              className={`flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 transition-colors ${
                invoiceTerms === "net_terms"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted/50"
              }`}
            >
              <RadioGroupItem value="net_terms" />
              <span className="text-sm">Net Terms</span>
            </label>
          </RadioGroup>

          {invoiceTerms === "net_terms" && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-2">
                <Label>Select Terms</Label>
                <Select
                  value={selectValue}
                  onValueChange={(v) => {
                    if (v === "custom") {
                      onChangeDays("");
                    } else {
                      onChangeDays(v);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select net terms" />
                  </SelectTrigger>
                  <SelectContent>
                    {NET_TERM_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isCustomDays && (
                <div className="flex flex-col gap-1">
                  <Label className="text-xs">Custom Days Until Due</Label>
                  <Input
                    type="number"
                    min="1"
                    placeholder="e.g. 120"
                    value={daysUntilDue}
                    onChange={(e) => onChangeDays(e.target.value)}
                  />
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                The customer will have{" "}
                <span className="font-medium">
                  {daysUntilDue ? `${daysUntilDue} days` : "---"}
                </span>{" "}
                to pay the invoice after it is issued.
              </p>
            </div>
          )}
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-5">{content}</div>;
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Payment Path</CardTitle>
        <CardDescription>
          Choose how the customer will pay when they accept the quote.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {content}
      </CardContent>
      <CardFooter className="justify-between border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!isValid}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}
