"use client";

import { useState, useTransition, useRef, useEffect } from "react";
import {
  Search,
  Loader2,
  Check,
  AlertTriangle,
  ExternalLink,
  User,
  Mail,
  Briefcase,
  Phone,
  RefreshCw,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import {
  searchCustomersUnified,
  resolveSfAccountForStripeCustomer,
  type UnifiedCustomer,
} from "@/lib/queries/customers";
import {
  getOpportunitiesForAccount,
  type OpportunityRow,
} from "@/lib/queries/opportunities";
import { getAccountContacts, type AccountContact } from "@/lib/queries/contacts";
import { formatCurrency } from "@/lib/format";
import type { QuoteCustomer, QuoteType, ContractMode } from "../wizard";

const SF_BASE =
  process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://raydiant.lightning.force.com";

const SHOWS_CONTRACT_MODE: QuoteType[] = ["Expansion", "Renewal", "Amendment"];

interface Props {
  quoteType: QuoteType;
  selected: QuoteCustomer | null;
  opportunityId: string;
  billToContactId: string;
  contractMode: ContractMode;
  onSelect: (customer: QuoteCustomer | null) => void;
  onOpportunityChange: (v: string) => void;
  onBillToContactChange: (v: string) => void;
  onContractModeChange: (v: ContractMode) => void;
  onNext: () => void;
}

export function PickCustomer({
  quoteType,
  selected,
  opportunityId,
  billToContactId,
  contractMode,
  onSelect,
  onOpportunityChange,
  onBillToContactChange,
  onContractModeChange,
  onNext,
}: Props) {
  // ── Customer search ──────────────────────────────────────
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UnifiedCustomer[]>([]);
  const [searched, setSearched] = useState(false);
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);

  // ── Opportunities ────────────────────────────────────────
  const [opportunities, setOpportunities] = useState<OpportunityRow[]>([]);
  const [oppsLoading, setOppsLoading] = useState(false);
  const [oppsError, setOppsError] = useState<string | null>(null);

  // ── Bill-To Contact ──────────────────────────────────────
  const [contacts, setContacts] = useState<AccountContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [billToContact, setBillToContact] = useState<AccountContact | null>(null);

  async function fetchAccountData(sfAccountId: string) {
    setOppsLoading(true);
    setOppsError(null);
    setContactsLoading(true);

    try {
      const [opps, ctcs] = await Promise.all([
        getOpportunitiesForAccount(sfAccountId, quoteType),
        getAccountContacts(sfAccountId),
      ]);
      setOpportunities(opps);
      setContacts(ctcs);

      const existing = ctcs.find((c) => c.isBillTo);
      if (existing) {
        setBillToContact(existing);
        onBillToContactChange(existing.id);
      } else {
        setBillToContact(null);
        onBillToContactChange("");
      }
    } catch (err) {
      setOppsError(err instanceof Error ? err.message : "Failed to load data");
    } finally {
      setOppsLoading(false);
      setContactsLoading(false);
    }
  }

  useEffect(() => {
    if (!selected?.sfAccountId) {
      setOpportunities([]);
      setContacts([]);
      setBillToContact(null);
      return;
    }
    fetchAccountData(selected.sfAccountId);
  }, [selected?.sfAccountId, quoteType]); // eslint-disable-line react-hooks/exhaustive-deps

  const [resolving, setResolving] = useState(false);

  async function handleCustomerSelect(c: UnifiedCustomer) {
    let sfAccountId = c.sfAccountId;
    let sfAccountName = c.name;

    if (!sfAccountId && c.stripeCustomerId) {
      setResolving(true);
      try {
        const resolved = await resolveSfAccountForStripeCustomer(c.stripeCustomerId);
        if (resolved) {
          sfAccountId = resolved.sfAccountId;
          sfAccountName = resolved.sfAccountName || c.name;
        }
      } catch {
        // resolution failed, proceed without sfAccountId
      } finally {
        setResolving(false);
      }
    }

    onSelect({
      id: c.id,
      sfAccountId,
      sfAccountName,
      stripeCustomerId: c.stripeCustomerId,
      domain: c.domain,
    });
    onOpportunityChange("");
    onBillToContactChange("");
    setQuery("");
    setResults([]);
    setSearched(false);
  }

  function handleSearch(value: string) {
    setQuery(value);
    if (timerRef.current) clearTimeout(timerRef.current);

    if (value.trim().length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }

    timerRef.current = setTimeout(() => {
      startTransition(async () => {
        const data = await searchCustomersUnified(value.trim());
        setResults(data);
        setSearched(true);
      });
    }, 300);
  }

  function formatOppDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const canProceed =
    !!selected?.stripeCustomerId && !!opportunityId && !!billToContactId;

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Select Customer</CardTitle>
        <CardDescription>
          Search for the customer, then pick an opportunity and verify the
          bill-to contact.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {/* ── Section A: Select Customer ───────────────────────── */}
        <div className="flex flex-col gap-2">

          {selected ? (
            <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {selected.sfAccountName ?? "---"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {[
                    selected.stripeCustomerId,
                    selected.domain,
                    selected.sfAccountId
                      ? `SFDC: ${selected.sfAccountId}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {!selected.sfAccountId && (
                  <Badge variant="outline" className="text-xs text-amber-600">
                    No SFDC Account
                  </Badge>
                )}
                {!selected.stripeCustomerId && (
                  <Badge variant="outline" className="text-xs text-destructive">
                    No Stripe ID
                  </Badge>
                )}
                {selected.stripeCustomerId && selected.sfAccountId && (
                  <Check className="size-4 text-primary" />
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => {
                    onSelect(null);
                    onOpportunityChange("");
                    onBillToContactChange("");
                  }}
                >
                  Change
                </Button>
              </div>
            </div>
          ) : (
            <>
              <Label>Customer</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                {isPending && (
                  <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
                <Input
                  type="search"
                  placeholder="Search by account name, domain, or Stripe ID..."
                  value={query}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9"
                  autoFocus
                />
              </div>

              {resolving && (
                <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                  <Loader2 className="size-3.5 animate-spin" />
                  Resolving Salesforce account...
                </div>
              )}

              {searched && results.length === 0 && !resolving && (
                <p className="py-3 text-center text-sm text-muted-foreground">
                  No customers found for &ldquo;{query}&rdquo;.
                </p>
              )}

              {results.length > 0 && (
                <div className="max-h-56 space-y-1 overflow-y-auto">
                  {results.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleCustomerSelect(c)}
                      className="flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors hover:bg-muted/50"
                    >
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium">{c.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {[
                            c.stripeCustomerId,
                            c.domain,
                            c.source !== "local" ? c.source : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </div>
                      {!c.stripeCustomerId && (
                        <Badge variant="outline" className="text-xs text-amber-600">
                          No Stripe ID
                        </Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Missing SF Account warning ─────────────────────── */}
        {selected && !selected.sfAccountId && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-4 dark:border-amber-900 dark:bg-amber-950/30">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
              <div>
                <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                  No Salesforce Account linked
                </p>
                <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                  This customer does not have a linked Salesforce Account, so
                  opportunities and bill-to contacts cannot be loaded.
                  Please link this customer to a Salesforce Account, or select a
                  different customer that has a Salesforce Account.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── Section B: Select Opportunity (after customer) ──── */}
        {selected?.sfAccountId && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-1.5">
                <Briefcase className="size-3.5" />
                {quoteType} Opportunities
              </Label>
              <button
                type="button"
                disabled={oppsLoading}
                onClick={() => {
                  if (selected?.sfAccountId) fetchAccountData(selected.sfAccountId);
                }}
                className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <RefreshCw className={`size-3 ${oppsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            </div>

            {oppsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading opportunities...
              </div>
            ) : oppsError ? (
              <div className="flex items-center gap-2 text-sm text-amber-600">
                <AlertTriangle className="size-3.5" />
                {oppsError}
              </div>
            ) : opportunities.length === 0 ? (
              <div className="rounded-md border border-dashed px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">
                  No <strong>{quoteType}</strong> opportunities found for{" "}
                  <strong>{selected.sfAccountName ?? "this customer"}</strong>.
                </p>
                <a
                  href={`${SF_BASE}/lightning/o/Opportunity/new`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                >
                  Create opportunity in Salesforce
                  <ExternalLink className="size-3" />
                </a>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50 text-left text-xs font-medium text-muted-foreground">
                      <th className="px-3 py-2">Name</th>
                      <th className="px-3 py-2">Type</th>
                      <th className="px-3 py-2">Stage</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                      <th className="px-3 py-2">Close Date</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {opportunities.map((opp) => {
                      const isSelected = opportunityId === opp.id;
                      return (
                        <tr
                          key={opp.id}
                          onClick={() => onOpportunityChange(opp.id)}
                          className={`cursor-pointer border-b transition-colors last:border-b-0 ${
                            isSelected
                              ? "bg-primary/5"
                              : "hover:bg-muted/30"
                          }`}
                        >
                          <td className="px-3 py-2 font-medium">{opp.name}</td>
                          <td className="px-3 py-2">
                            <Badge variant="outline" className="text-xs">
                              {opp.type ?? "—"}
                            </Badge>
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="secondary" className="text-xs">
                              {opp.stageName}
                            </Badge>
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {opp.amount !== null
                              ? formatCurrency(opp.amount * 100)
                              : "—"}
                          </td>
                          <td className="px-3 py-2 tabular-nums">
                            {formatOppDate(opp.closeDate)}
                          </td>
                          <td className="px-3 py-2 text-center">
                            {isSelected && (
                              <Check className="inline size-4 text-primary" />
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Section C: Bill-To Contact (after customer) ────── */}
        {selected?.sfAccountId && (
          <div className="flex flex-col gap-2 border-t pt-4">
            <Label className="flex items-center gap-1.5">
              <User className="size-3.5" />
              Bill-To Contact
            </Label>

            {contactsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading contacts...
              </div>
            ) : billToContact ? (
              <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">
                      {billToContact.firstName} {billToContact.lastName}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      Bill-To
                    </Badge>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail className="size-3" />
                      {billToContact.email}
                    </span>
                    {billToContact.title && (
                      <span className="flex items-center gap-1">
                        <Briefcase className="size-3" />
                        {billToContact.title}
                      </span>
                    )}
                    {billToContact.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="size-3" />
                        {billToContact.phone}
                      </span>
                    )}
                  </div>
                </div>
                <Check className="size-4 text-primary" />
              </div>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                      No Bill-To contact set
                    </p>
                    <p className="mt-0.5 text-xs text-amber-700 dark:text-amber-400">
                      Please set a Bill-To contact on the Account record in
                      Salesforce, then come back here.
                    </p>
                    <a
                      href={`${SF_BASE}/lightning/r/Account/${selected.sfAccountId}/view`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-400"
                    >
                      Open Account in Salesforce
                      <ExternalLink className="size-3" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Section D: Contract Mode (non-New types) ──────── */}
        {selected?.sfAccountId && SHOWS_CONTRACT_MODE.includes(quoteType) && (
          <div className="flex flex-col gap-3 border-t pt-4">
            <Label>Contract Structure</Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onContractModeChange("new_contract")}
                className={`flex flex-col gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  contractMode === "new_contract"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <span className="text-sm font-medium">New Contract</span>
                <span className="text-xs text-muted-foreground">
                  Create a standalone contract with its own term and billing
                  cycle.
                </span>
              </button>
              <button
                type="button"
                onClick={() => onContractModeChange("co_term")}
                className={`flex flex-col gap-1 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
                  contractMode === "co_term"
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/40"
                }`}
              >
                <span className="text-sm font-medium">Co-term</span>
                <span className="text-xs text-muted-foreground">
                  Align to an existing subscription&apos;s end date and billing
                  cycle.
                </span>
              </button>
            </div>
          </div>
        )}

      </CardContent>
      <CardFooter className="justify-end border-t">
        <Button onClick={onNext} disabled={!canProceed}>
          Continue
        </Button>
      </CardFooter>
    </Card>
  );
}
