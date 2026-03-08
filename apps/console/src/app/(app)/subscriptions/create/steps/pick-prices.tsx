"use client";

import { useState, useTransition, useEffect } from "react";
import { Search, Loader2, Plus, Minus, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { searchStripePrices, type StripePrice } from "@/lib/queries/stripe-prices";
import { formatCurrency } from "@/lib/format";
import type { LineItem } from "@/lib/actions/create-subscription";

interface Props {
  lineItems: LineItem[];
  onChange: (items: LineItem[]) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PickPrices({ lineItems, onChange, onNext, onBack }: Props) {
  const [query, setQuery] = useState("");
  const [prices, setPrices] = useState<StripePrice[]>([]);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const data = await searchStripePrices("");
      setPrices(data);
    });
  }, []);

  function handleSearch(value: string) {
    setQuery(value);
    startTransition(async () => {
      const data = await searchStripePrices(value);
      setPrices(data);
    });
  }

  function addPrice(price: StripePrice) {
    if (lineItems.some((li) => li.priceId === price.id)) return;
    onChange([
      ...lineItems,
      {
        priceId: price.id,
        nickname: price.nickname,
        unitAmount: price.unitAmount,
        currency: price.currency,
        interval: price.interval,
        quantity: 1,
      },
    ]);
  }

  function updateQuantity(priceId: string, delta: number) {
    onChange(
      lineItems.map((li) =>
        li.priceId === priceId
          ? { ...li, quantity: Math.max(1, li.quantity + delta) }
          : li,
      ),
    );
  }

  function removeItem(priceId: string) {
    onChange(lineItems.filter((li) => li.priceId !== priceId));
  }

  const selectedIds = new Set(lineItems.map((li) => li.priceId));

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Select Prices</h2>
          <p className="text-sm text-muted-foreground">
            Choose one or more Stripe prices and set quantities.
          </p>
        </div>

        {/* Selected items */}
        {lineItems.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Selected ({lineItems.length})
            </p>
            {lineItems.map((li) => (
              <div
                key={li.priceId}
                className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{li.nickname}</span>
                  <span className="text-xs text-muted-foreground font-mono">
                    {formatCurrency(li.unitAmount, li.currency)}/{li.interval}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => updateQuantity(li.priceId, -1)}
                    disabled={li.quantity <= 1}
                  >
                    <Minus />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium tabular-nums">
                    {li.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-xs"
                    onClick={() => updateQuantity(li.priceId, 1)}
                  >
                    <Plus />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    onClick={() => removeItem(li.priceId)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          <Input
            type="search"
            placeholder="Filter prices…"
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Available prices */}
        <div className="max-h-60 space-y-1 overflow-y-auto">
          {prices
            .filter((p) => !selectedIds.has(p.id))
            .map((price) => (
              <button
                key={price.id}
                type="button"
                onClick={() => addPrice(price)}
                className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{price.nickname}</span>
                  <span className="text-xs text-muted-foreground">
                    {price.productName}
                    <span className="ml-2 font-mono">{price.id}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="font-mono text-xs">
                    {formatCurrency(price.unitAmount, price.currency)}/{price.interval}
                  </Badge>
                  <Plus className="size-4 text-muted-foreground" />
                </div>
              </button>
            ))}
        </div>

        {/* Navigation */}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack}>
            Back
          </Button>
          <Button onClick={onNext} disabled={lineItems.length === 0}>
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
