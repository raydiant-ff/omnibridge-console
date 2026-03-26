"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronRight, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MyAccount } from "@/lib/queries/customers";

type SortDir = "asc" | "desc" | null;
type SortField = "mrr" | "arr";

function fmtCurrency(val: number | null) {
  if (val == null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(val);
}

function fmtDate(val: string | null) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function unique(values: (string | null | undefined)[]): string[] {
  return [...new Set(values.filter((v): v is string => !!v))].sort();
}

function SortButton({
  field,
  label,
  activeField,
  activeDir,
  onToggle,
}: {
  field: SortField;
  label: string;
  activeField: SortField | null;
  activeDir: SortDir;
  onToggle: (f: SortField) => void;
}) {
  const isActive = activeField === field;
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded-md border border-input bg-background px-2.5 py-1 text-xs font-medium shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors"
      onClick={() => onToggle(field)}
    >
      {label}
      {isActive && activeDir === "asc" ? (
        <ChevronUp className="size-3.5" />
      ) : isActive && activeDir === "desc" ? (
        <ChevronDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3 opacity-40" />
      )}
    </button>
  );
}

interface AccountsTableProps {
  myAccounts: MyAccount[];
  allAccounts: MyAccount[] | null;
  isAdmin: boolean;
}

export function AccountsTable({ myAccounts, allAccounts, isAdmin }: AccountsTableProps) {
  const [view, setView] = useState<"my" | "all">("my");
  const [ownerFilter, setOwnerFilter] = useState("__all__");
  const [csmFilter, setCsmFilter] = useState("__all__");
  const [statusFilter, setStatusFilter] = useState("__all__");
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  const sourceAccounts = view === "all" && allAccounts ? allAccounts : myAccounts;

  const owners = useMemo(() => unique(sourceAccounts.map((a) => a.ownerName)), [sourceAccounts]);
  const csms = useMemo(() => unique(sourceAccounts.map((a) => a.csmName)), [sourceAccounts]);
  const statuses = useMemo(() => unique(sourceAccounts.map((a) => a.status)), [sourceAccounts]);

  const filtered = useMemo(() => {
    let list = sourceAccounts;
    if (ownerFilter !== "__all__") list = list.filter((a) => a.ownerName === ownerFilter);
    if (csmFilter !== "__all__") list = list.filter((a) => a.csmName === csmFilter);
    if (statusFilter !== "__all__") list = list.filter((a) => a.status === statusFilter);

    if (sortField && sortDir) {
      const key = sortField === "mrr" ? "accountValue" : "totalArr";
      const mult = sortDir === "asc" ? 1 : -1;
      list = [...list].sort((a, b) => ((a[key] ?? 0) - (b[key] ?? 0)) * mult);
    }

    return list;
  }, [sourceAccounts, ownerFilter, csmFilter, statusFilter, sortField, sortDir]);

  function toggleSort(field: SortField) {
    if (sortField !== field) {
      setSortField(field);
      setSortDir("desc");
    } else if (sortDir === "desc") {
      setSortDir("asc");
    } else {
      setSortField(null);
      setSortDir(null);
    }
  }

  return (
    <Card>
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-foreground">Accounts</h3>
            <p className="text-sm text-muted-foreground">
              {filtered.length} account{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== sourceAccounts.length && ` of ${sourceAccounts.length}`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <Select value={view} onValueChange={(v) => { setView(v as "my" | "all"); setOwnerFilter("__all__"); setCsmFilter("__all__"); setStatusFilter("__all__"); }}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="my">My Accounts</SelectItem>
                  <SelectItem value="all">All Accounts</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="Owner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Owners</SelectItem>
                {owners.map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={csmFilter} onValueChange={setCsmFilter}>
              <SelectTrigger className="h-8 w-[140px] text-xs">
                <SelectValue placeholder="CSM" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All CSMs</SelectItem>
                {csms.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-8 w-[130px] text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All Statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <SortButton field="mrr" label="MRR" activeField={sortField} activeDir={sortDir} onToggle={toggleSort} />
            <SortButton field="arr" label="ARR" activeField={sortField} activeDir={sortDir} onToggle={toggleSort} />
          </div>
        </div>
      </div>
      <div className="divide-y divide-border">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No accounts match the current filters. Try adjusting your filters.
          </div>
        ) : (
          filtered.map((a) => {
            const sfBase = process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://yourorg.lightning.force.com";
            const sfUrl = `${sfBase}/lightning/r/Account/${a.id}/view`;
            const stripeUrl = a.stripeCustomerId
              ? `https://dashboard.stripe.com/customers/${a.stripeCustomerId}`
              : null;

            return (
              <Link
                key={a.id}
                href={`/customers/${a.id}`}
                className="flex items-center gap-4 p-4 hover:bg-muted/30 transition-colors cursor-pointer group"
              >
                {/* Status Icon */}
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${a.status === "Active" || a.status === "Active Customer" ? "bg-success/10" : "bg-muted"}`}>
                  <span className="text-xs font-semibold text-muted-foreground">
                    {a.name.slice(0, 2).toUpperCase()}
                  </span>
                </div>

                {/* Account Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-foreground truncate">{a.name}</span>
                    {a.status ? (
                      <Badge variant={a.status === "Active" || a.status === "Active Customer" ? "success" : "secondary"} className="shrink-0">
                        {a.status}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className={a.ownerName ? "text-foreground" : "text-muted-foreground"}>{a.ownerName ?? "No owner"}</span>
                    <span className="text-muted-foreground opacity-40">&middot;</span>
                    <span className={a.csmName ? "text-foreground" : "text-muted-foreground"}>{a.csmName ?? "No CSM"}</span>
                    <span className="text-muted-foreground opacity-40">&middot;</span>
                    <span className={a.dateOfFirstClosedWon ? "text-foreground" : "text-muted-foreground"}>{fmtDate(a.dateOfFirstClosedWon)}</span>
                  </div>
                </div>

                {/* Meta Info */}
                <div className="flex items-center gap-6 text-sm shrink-0">
                  <div className="text-right">
                    <div className="font-semibold font-mono tabular-nums">{fmtCurrency(a.accountValue)}</div>
                    <div className={`text-xs font-mono font-medium tabular-nums ${a.totalArr ? "text-foreground" : "text-muted-foreground"}`}>{fmtCurrency(a.totalArr)} ARR</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="outline" size="sm" className="h-7 gap-1 px-2" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                      <a href={sfUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-5 w-auto" />
                        <ExternalLink className="size-3" />
                      </a>
                    </Button>
                    {stripeUrl ? (
                      <Button variant="outline" size="sm" className="h-7 gap-1 px-2" asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                        <a href={stripeUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/images/stripe-logo.svg" alt="Stripe" className="h-5 w-auto" />
                          <ExternalLink className="size-3" />
                        </a>
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" className="h-7 px-2 opacity-30" disabled>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="/images/stripe-logo.svg" alt="Stripe" className="h-5 w-auto opacity-30" />
                      </Button>
                    )}
                  </div>
                  <ChevronRight className="size-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            );
          })
        )}
      </div>
    </Card>
  );
}

