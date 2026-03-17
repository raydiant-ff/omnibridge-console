"use client";

import { useState, useTransition, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createOpportunityAction } from "@/lib/actions/opportunities";
import { searchSalesforceAccounts } from "@/lib/queries/opportunities";
import { CheckCircle2, Loader2, Search } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";

interface StageOption {
  value: string;
  disabledReason?: string;
  adminOnly?: boolean;
}

const STAGES: StageOption[] = [
  { value: "Discovery & Qualification" },
  { value: "Customer Evaluation" },
  { value: "Pricing & Negotiation" },
  { value: "Contract Sent", disabledReason: "Set automatically" },
  { value: "Closed Won", adminOnly: true, disabledReason: "Admin only" },
  { value: "Closed Lost", adminOnly: true, disabledReason: "Admin only" },
];

interface AccountOption {
  id: string;
  name: string;
  industry: string | null;
}

export default function CreateOpportunityPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const isAdmin = session?.user?.role === "admin";
  const [isPending, startTransition] = useTransition();

  const [accountSearch, setAccountSearch] = useState("");
  const [accountResults, setAccountResults] = useState<AccountOption[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<AccountOption | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState("");
  const [stage, setStage] = useState("");

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string } | null>(null);

  const doSearch = useCallback(async (term: string) => {
    if (term.length < 2) {
      setAccountResults([]);
      setShowDropdown(false);
      return;
    }
    setSearching(true);
    try {
      const results = await searchSalesforceAccounts(term);
      setAccountResults(results);
      setShowDropdown(results.length > 0);
    } catch {
      setAccountResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (selectedAccount) return;
    searchTimeout.current = setTimeout(() => doSearch(accountSearch), 300);
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current);
    };
  }, [accountSearch, selectedAccount, doSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectAccount(acc: AccountOption) {
    setSelectedAccount(acc);
    setAccountSearch(acc.name);
    setShowDropdown(false);
  }

  function clearAccount() {
    setSelectedAccount(null);
    setAccountSearch("");
    setAccountResults([]);
  }

  function handleSubmit() {
    setError(null);

    if (!selectedAccount) {
      setError("Please select an account.");
      return;
    }
    if (!name.trim()) {
      setError("Opportunity name is required.");
      return;
    }
    if (!stage) {
      setError("Stage is required.");
      return;
    }

    startTransition(async () => {
      const result = await createOpportunityAction({
        accountId: selectedAccount.id,
        accountName: selectedAccount.name,
        name: name.trim(),
        stageName: stage,
      });

      if (!result.success) {
        setError(result.error ?? "Failed to create opportunity.");
      } else {
        setSuccess({ id: result.opportunityId! });
      }
    });
  }

  if (success) {
    return (
      <div className="flex flex-col gap-6">
        <PageHeader title="Create Opportunity" />
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-16">
            <CheckCircle2 className="size-12 text-green-500" />
            <div className="text-center">
              <h2 className="text-lg font-semibold">Opportunity Created</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Salesforce ID: <code className="rounded bg-muted px-1.5 py-0.5">{success.id}</code>
              </p>
            </div>
            <div className="mt-2 flex gap-3">
              <Button variant="outline" onClick={() => router.push("/opportunities/my")}>
                View My Opportunities
              </Button>
              <Button
                onClick={() => {
                  setSuccess(null);
                  setSelectedAccount(null);
                  setAccountSearch("");
                  setName("");
                  setStage("");
                }}
              >
                Create Another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Create Opportunity"
        description="Create a new opportunity in Salesforce without going through CPQ."
      />

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Opportunity Details</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          {/* Account Search */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="account">Account *</Label>
            <div className="relative" ref={dropdownRef}>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="account"
                  placeholder="Search Salesforce accounts..."
                  value={accountSearch}
                  onChange={(e) => {
                    setAccountSearch(e.target.value);
                    if (selectedAccount) clearAccount();
                  }}
                  onFocus={() => {
                    if (accountResults.length > 0 && !selectedAccount) setShowDropdown(true);
                  }}
                  className="pl-9"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
              {showDropdown && (
                <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md">
                  <ul className="max-h-56 overflow-y-auto py-1">
                    {accountResults.map((acc) => (
                      <li key={acc.id}>
                        <button
                          type="button"
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-accent"
                          onClick={() => selectAccount(acc)}
                        >
                          <span className="font-medium">{acc.name}</span>
                          {acc.industry && (
                            <span className="text-xs text-muted-foreground">
                              {acc.industry}
                            </span>
                          )}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {selectedAccount && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="size-3.5 text-green-500" />
                <span>{selectedAccount.name}</span>
                <button
                  type="button"
                  className="text-xs underline hover:text-foreground"
                  onClick={clearAccount}
                >
                  change
                </button>
              </div>
            )}
          </div>

          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="opp-name">Opportunity Name *</Label>
            <Input
              id="opp-name"
              placeholder="e.g. Acme Corp - Enterprise Plan"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Stage */}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="stage">Stage *</Label>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a stage" />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => {
                  const disabled = s.disabledReason
                    ? s.adminOnly ? !isAdmin : true
                    : false;
                  return (
                    <SelectItem key={s.value} value={s.value} disabled={disabled}>
                      <span className="flex items-center gap-2">
                        {s.value}
                        {disabled && s.disabledReason && (
                          <span className="text-xs text-muted-foreground">
                            ({s.disabledReason})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Created Date (read-only, auto-set) */}
          <div className="flex flex-col gap-1.5">
            <Label>Created Date</Label>
            <Input
              type="date"
              value={new Date().toISOString().slice(0, 10)}
              disabled
              className="bg-muted"
            />
            <p className="text-xs text-muted-foreground">
              Set automatically to today. Close date and amount are determined by
              the quote.
            </p>
          </div>

          {error && (
            <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create Opportunity"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
