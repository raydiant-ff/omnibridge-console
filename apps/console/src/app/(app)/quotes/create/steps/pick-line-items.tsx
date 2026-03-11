"use client";

import { useState, useTransition, useEffect, useMemo, useCallback, useRef } from "react";
import {
  Search,
  Loader2,
  Plus,
  Minus,
  Trash2,
  Package,
  ArrowDown,
  ArrowUp,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  fetchStripeProducts,
  fetchStandardPriceForProduct,
  type StripeProduct,
  type StripeProductPrice,
} from "@/lib/queries/stripe-products";
import { formatCurrency } from "@/lib/format";
import {
  convertPriceToFrequency,
  convertPriceFromFrequency,
  billingFrequencyIntervalLabel,
  BILLING_FREQUENCY_LABELS,
} from "@/lib/billing-utils";
import type { BillingFrequency } from "@/lib/billing-utils";
import type { QuoteLineItem } from "@/lib/actions/quotes";

interface Props {
  lineItems: QuoteLineItem[];
  billingFrequency: BillingFrequency;
  onChange: (items: QuoteLineItem[]) => void;
  onNext?: () => void;
  onBack?: () => void;
  embedded?: boolean;
}

export function PickLineItems({ lineItems, billingFrequency, onChange, onNext, onBack, embedded }: Props) {
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<StripeProduct[]>([]);
  const [isLoading, startTransition] = useTransition();
  const [standardPrices, setStandardPrices] = useState<
    Record<string, StripeProductPrice | null>
  >({});
  const [loadingProduct, setLoadingProduct] = useState<string | null>(null);

  const freqLabel = billingFrequencyIntervalLabel(billingFrequency);

  const isOneTime = useCallback(
    (interval: string | undefined | null) =>
      !interval || interval === "one-time" || interval === "one_time",
    [],
  );

  const toDisplay = useCallback(
    (amount: number, interval: string) => {
      if (isOneTime(interval)) return amount;
      return convertPriceToFrequency(amount, interval, billingFrequency);
    },
    [billingFrequency, isOneTime],
  );

  const fromDisplay = useCallback(
    (displayCents: number, interval: string) => {
      if (isOneTime(interval)) return displayCents;
      return convertPriceFromFrequency(displayCents, billingFrequency, interval);
    },
    [billingFrequency, isOneTime],
  );

  function fmtLabel(interval: string | undefined | null): string {
    if (isOneTime(interval)) return " one-time";
    return `/${freqLabel}`;
  }

  useEffect(() => {
    startTransition(async () => {
      const data = await fetchStripeProducts();
      setProducts(data.filter((p) => p.active));
    });
  }, []);

  const filteredProducts = useMemo(() => {
    if (!query) return products;
    const q = query.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        (p.description ?? "").toLowerCase().includes(q),
    );
  }, [products, query]);

  async function addProduct(product: StripeProduct) {
    let stdPrice = standardPrices[product.id];
    if (stdPrice === undefined) {
      setLoadingProduct(product.id);
      stdPrice = await fetchStandardPriceForProduct(
        product.id,
        product.defaultPriceId,
        product.metadata,
      );
      setStandardPrices((prev) => ({ ...prev, [product.id]: stdPrice }));
      setLoadingProduct(null);
    }

    if (!stdPrice) return;

    const sfProductId =
      product.metadata?.salesforce_product_id ??
      product.metadata?.salesforce_product2_id ??
      product.metadata?.sf_product_id ??
      null;

    onChange([
      ...lineItems,
      {
        priceId: stdPrice.id,
        productId: product.id,
        productName: product.name,
        quantity: 1,
        nickname: stdPrice.nickname ?? product.name,
        unitAmount: stdPrice.unitAmount ?? 0,
        currency: stdPrice.currency,
        interval: stdPrice.interval ?? "one-time",
        sfProductId,
      },
    ]);
  }

  function updateQuantity(index: number, delta: number) {
    onChange(
      lineItems.map((li, i) =>
        i === index
          ? { ...li, quantity: Math.max(1, li.quantity + delta) }
          : li,
      ),
    );
  }

  function updateOverridePrice(index: number, dollars: string) {
    const li = lineItems[index];
    const displayCents = dollars === "" ? null : Math.round(parseFloat(dollars) * 100);
    const nativeCents = displayCents != null ? fromDisplay(displayCents, li.interval) : null;
    onChange(
      lineItems.map((l, i) =>
        i === index ? { ...l, overrideUnitAmount: nativeCents } : l,
      ),
    );
  }

  function removeItem(index: number) {
    onChange(lineItems.filter((_, i) => i !== index));
  }

  function effectiveUnit(li: QuoteLineItem): number {
    return li.overrideUnitAmount ?? li.unitAmount;
  }

  const total = lineItems.reduce(
    (acc, li) => acc + toDisplay(effectiveUnit(li), li.interval) * li.quantity,
    0,
  );

  const standardTotal = lineItems.reduce(
    (acc, li) => acc + toDisplay(li.unitAmount, li.interval) * li.quantity,
    0,
  );

  const totalDelta = total - standardTotal;

  const selectedProductIds = new Set(lineItems.map((li) => li.productId));

  const content = (
    <>
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold">Line Items</h2>
          <p className="text-sm text-muted-foreground">
            Select products from the catalog. Prices shown per{" "}
            <span className="font-medium text-foreground">
              {BILLING_FREQUENCY_LABELS[billingFrequency].toLowerCase()}
            </span>{" "}
            billing cycle.
          </p>
        </div>
      )}

      {lineItems.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Selected ({lineItems.length})
          </p>
          {lineItems.map((li, idx) => (
            <div
              key={idx}
              className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{li.productName}</span>
                  <span className="text-xs text-muted-foreground">
                    {li.nickname}
                    <span className="ml-2 font-mono opacity-60">
                      {li.priceId}
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-muted-foreground">
                    {formatCurrency(toDisplay(li.unitAmount, li.interval), li.currency)}{fmtLabel(li.interval)}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => updateQuantity(idx, -1)}
                    disabled={li.quantity <= 1}
                  >
                    <Minus className="size-3" />
                  </Button>
                  <span className="w-8 text-center text-sm font-medium tabular-nums">
                    {li.quantity}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 w-7 p-0"
                    onClick={() => updateQuantity(idx, 1)}
                  >
                    <Plus className="size-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    onClick={() => removeItem(idx)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 border-t border-primary/10 pt-2">
                <span className="text-xs text-muted-foreground">Unit price:</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">$</span>
                  <PriceInput
                    displayValue={toDisplay(effectiveUnit(li), li.interval) / 100}
                    onCommit={(dollars) => updateOverridePrice(idx, dollars)}
                  />
                  <span className="text-xs text-muted-foreground">{fmtLabel(li.interval)}</span>
                </div>
                {li.overrideUnitAmount != null && li.overrideUnitAmount !== li.unitAmount ? (
                  li.overrideUnitAmount < li.unitAmount ? (
                    <div className="ml-auto flex items-center gap-1.5">
                      <Badge variant="secondary" className="gap-1 text-xs text-green-700">
                        <ArrowDown className="size-3" />
                        Discount
                      </Badge>
                      <span className="font-mono text-xs text-green-600">
                        {formatCurrency((toDisplay(li.unitAmount, li.interval) - toDisplay(effectiveUnit(li), li.interval)) * li.quantity, li.currency)}
                      </span>
                    </div>
                  ) : (
                    <div className="ml-auto flex items-center gap-1.5">
                      <Badge variant="secondary" className="gap-1 text-xs text-amber-700">
                        <ArrowUp className="size-3" />
                        Premium
                      </Badge>
                      <span className="font-mono text-xs text-amber-600">
                        {formatCurrency((toDisplay(effectiveUnit(li), li.interval) - toDisplay(li.unitAmount, li.interval)) * li.quantity, li.currency)}
                      </span>
                    </div>
                  )
                ) : (
                  <span className="ml-auto font-mono text-xs text-muted-foreground">
                    {formatCurrency(toDisplay(li.unitAmount, li.interval) * li.quantity, li.currency)}
                  </span>
                )}
              </div>
            </div>
          ))}
          <div className="space-y-1">
            {totalDelta !== 0 && (
              <div className="flex items-center justify-between rounded-lg bg-muted/30 px-4 py-1.5">
                <span className="text-xs text-muted-foreground">Standard total</span>
                <span className="font-mono text-xs text-muted-foreground">
                  {formatCurrency(standardTotal, lineItems[0]?.currency ?? "usd")}
                </span>
              </div>
            )}
            {totalDelta < 0 && (
              <div className="flex items-center justify-between rounded-lg bg-green-50 px-4 py-1.5">
                <span className="text-xs font-medium text-green-700">Discount</span>
                <span className="font-mono text-xs font-medium text-green-700">
                  {formatCurrency(totalDelta, lineItems[0]?.currency ?? "usd")}
                </span>
              </div>
            )}
            {totalDelta > 0 && (
              <div className="flex items-center justify-between rounded-lg bg-amber-50 px-4 py-1.5">
                <span className="text-xs font-medium text-amber-700">Premium</span>
                <span className="font-mono text-xs font-medium text-amber-700">
                  +{formatCurrency(totalDelta, lineItems[0]?.currency ?? "usd")}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-2">
              <span className="text-sm font-medium">
                Total{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  /{freqLabel}
                </span>
              </span>
              <span className="font-mono text-sm font-bold">
                {formatCurrency(total, lineItems[0]?.currency ?? "usd")}
              </span>
            </div>
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
        <Input
          type="search"
          placeholder="Search products by name or ID..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="max-h-72 space-y-1 overflow-y-auto">
        {filteredProducts.length === 0 && !isLoading && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No products found.
          </p>
        )}
        {filteredProducts.map((product) => {
          const alreadyAdded = selectedProductIds.has(product.id);
          const isLoadingThis = loadingProduct === product.id;
          const cachedPrice = standardPrices[product.id];

          return (
            <button
              key={product.id}
              type="button"
              disabled={isLoadingThis}
              onClick={() => addProduct(product)}
              className={`flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors ${
                alreadyAdded
                  ? "border-primary/20 bg-primary/5 hover:bg-primary/10"
                  : "hover:bg-muted/50"
              }`}
            >
              <Package className="size-4 shrink-0 text-muted-foreground" />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">{product.name}</span>
                {product.description && (
                  <span
                    className="truncate text-xs text-muted-foreground"
                    style={{
                      maxWidth: `${Math.max(product.name.length, 20)}ch`,
                    }}
                  >
                    {product.description}
                  </span>
                )}
              </div>
              {cachedPrice && (
                <Badge variant="outline" className="shrink-0 font-mono text-xs">
                  {formatCurrency(
                    toDisplay(cachedPrice.unitAmount ?? 0, cachedPrice.interval ?? "one-time"),
                    cachedPrice.currency,
                  )}
                  {fmtLabel(cachedPrice.interval)}
                </Badge>
              )}
              <div className="flex shrink-0 items-center gap-2">
                {isLoadingThis ? (
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                ) : (
                  <>
                    {alreadyAdded && (
                      <Badge variant="secondary" className="text-xs">
                        ×{lineItems.filter((li) => li.productId === product.id).length}
                      </Badge>
                    )}
                    <Plus className="size-4 text-muted-foreground" />
                  </>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-5">{content}</div>;
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Line Items</CardTitle>
        <CardDescription>
          Select products from the catalog. Prices shown per{" "}
          {BILLING_FREQUENCY_LABELS[billingFrequency].toLowerCase()} billing cycle.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {content}
      </CardContent>
      <CardFooter className="justify-between border-t">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={lineItems.length === 0}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}

function PriceInput({
  displayValue,
  onCommit,
}: {
  displayValue: number;
  onCommit: (dollars: string) => void;
}) {
  const [localValue, setLocalValue] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const shownValue = localValue ?? displayValue.toFixed(2);

  function commit() {
    if (localValue !== null) {
      onCommit(localValue === "" ? "" : localValue);
      setLocalValue(null);
    }
  }

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      min={0}
      step={0.01}
      value={shownValue}
      onFocus={() => setLocalValue(displayValue.toFixed(2))}
      onChange={(e) => {
        const v = e.target.value;
        if (v === "" || /^\d*\.?\d{0,2}$/.test(v)) {
          setLocalValue(v);
        }
      }}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          commit();
          inputRef.current?.blur();
        }
      }}
      className="h-7 w-24 font-mono text-xs"
    />
  );
}
