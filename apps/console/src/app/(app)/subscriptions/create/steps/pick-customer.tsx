"use client";

import { useState, useTransition, useRef } from "react";
import { Search, Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { searchCustomers } from "@/lib/queries/customers";
import type { WizardCustomer } from "../wizard";

interface Props {
  selected: WizardCustomer | null;
  onSelect: (customer: WizardCustomer) => void;
}

type CustomerResult = Awaited<ReturnType<typeof searchCustomers>>[number];

export function PickCustomer({ selected, onSelect }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  function handleChange(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const data = await searchCustomers(value.trim());
        setResults(data);
        setSearched(true);
      });
    }, 300);
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Select Customer</h2>
          <p className="text-sm text-muted-foreground">
            Search by account name, domain, or Stripe/Salesforce ID.
          </p>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          {isPending && (
            <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
          )}
          <Input
            type="search"
            placeholder="Search customers…"
            value={query}
            onChange={(e) => handleChange(e.target.value)}
            className="pl-9"
            autoFocus
          />
        </div>

        {searched && results.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            No customers found for &ldquo;{query}&rdquo;.
          </p>
        )}

        {results.length > 0 && (
          <div className="max-h-72 space-y-1 overflow-y-auto">
            {results.map((c) => {
              const isSelected = selected?.id === c.id;
              const hasStripe = !!c.stripeCustomerId;

              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() =>
                    hasStripe &&
                    onSelect({
                      id: c.id,
                      sfAccountName: c.sfAccountName,
                      stripeCustomerId: c.stripeCustomerId,
                      domain: c.domain,
                    })
                  }
                  disabled={!hasStripe}
                  className={`flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors ${
                    isSelected
                      ? "border-primary bg-primary/5"
                      : hasStripe
                        ? "hover:bg-muted/50 cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                  }`}
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium">
                      {c.sfAccountName ?? "—"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {[c.domain, c.stripeCustomerId].filter(Boolean).join(" · ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {!hasStripe && (
                      <Badge variant="outline" className="text-xs text-destructive">
                        No Stripe ID
                      </Badge>
                    )}
                    {isSelected && <Check className="size-4 text-primary" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
