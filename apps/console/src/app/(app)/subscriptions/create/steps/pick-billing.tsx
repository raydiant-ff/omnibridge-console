"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props {
  billingMode: "now" | "future";
  billingDate: string;
  onChangeMode: (v: "now" | "future") => void;
  onChangeDate: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PickBilling({
  billingMode,
  billingDate,
  onChangeMode,
  onChangeDate,
  onNext,
  onBack,
}: Props) {
  const isValid =
    billingMode === "now" ||
    (billingMode === "future" && billingDate && new Date(billingDate) > new Date());

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Billing Option</h2>
          <p className="text-sm text-muted-foreground">
            Choose when the customer should be invoiced.
          </p>
        </div>

        <RadioGroup
          value={billingMode}
          onValueChange={(v) => onChangeMode(v as "now" | "future")}
          className="space-y-3"
        >
          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              billingMode === "now" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <RadioGroupItem value="now" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Bill now</span>
              <span className="text-xs text-muted-foreground">
                Create an invoice immediately when the subscription starts. Stripe will
                charge the customer right away.
              </span>
            </div>
          </label>

          <label
            className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
              billingMode === "future" ? "border-primary bg-primary/5" : "hover:bg-muted/50"
            }`}
          >
            <RadioGroupItem value="future" className="mt-0.5" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium">Bill on a specific date</span>
              <span className="text-xs text-muted-foreground">
                Delay the first invoice to a chosen future date. No prorations will be
                created before that date.
              </span>
            </div>
          </label>
        </RadioGroup>

        {billingMode === "future" && (
          <div className="flex flex-col gap-2">
            <Label htmlFor="billing-date">Billing Date &amp; Time</Label>
            <Input
              id="billing-date"
              type="datetime-local"
              value={billingDate}
              onChange={(e) => onChangeDate(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
            {billingDate && new Date(billingDate) <= new Date() && (
              <p className="text-xs text-destructive">
                Billing date must be in the future.
              </p>
            )}
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext} disabled={!isValid}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
