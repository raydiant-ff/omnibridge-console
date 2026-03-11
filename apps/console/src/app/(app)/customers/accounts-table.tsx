"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpDown, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
      className="inline-flex items-center gap-0.5 font-medium"
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
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Accounts</CardTitle>
            <CardDescription>
              {filtered.length} account{filtered.length !== 1 ? "s" : ""}
              {filtered.length !== sourceAccounts.length && ` of ${sourceAccounts.length}`}
            </CardDescription>
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
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            No accounts match the current filters. Try adjusting your filters.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account Name</TableHead>
                <TableHead>First Closed Won</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>CSM</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">
                  <SortButton field="mrr" label="MRR" activeField={sortField} activeDir={sortDir} onToggle={toggleSort} />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="arr" label="ARR" activeField={sortField} activeDir={sortDir} onToggle={toggleSort} />
                </TableHead>
                <TableHead>Links</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((a) => {
                const sfBase = process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://raydiant.lightning.force.com";
                const sfUrl = `${sfBase}/lightning/r/Account/${a.id}/view`;
                const stripeUrl = a.stripeCustomerId
                  ? `https://dashboard.stripe.com/customers/${a.stripeCustomerId}`
                  : null;

                return (
                  <TableRow key={a.id}>
                    <TableCell className="whitespace-nowrap">
                      <Link
                        href={`/customers/${a.id}`}
                        className="font-medium hover:underline"
                        title={a.name}
                      >
                        {a.name.length > 40 ? `${a.name.slice(0, 40)}…` : a.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fmtDate(a.dateOfFirstClosedWon)}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground" title={a.ownerName ?? undefined}>
                      {a.ownerName ?? "—"}
                    </TableCell>
                    <TableCell className="max-w-[160px] truncate text-muted-foreground" title={a.csmName ?? undefined}>
                      {a.csmName ?? "—"}
                    </TableCell>
                    <TableCell>
                      {a.status ? (
                        <Badge variant={a.status === "Active" || a.status === "Active Customer" ? "success" : "secondary"}>
                          {a.status}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(a.accountValue)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {fmtCurrency(a.totalArr)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 gap-1 px-2" asChild>
                          <a href={sfUrl} target="_blank" rel="noopener noreferrer">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-5 w-auto" />
                            <ExternalLink className="size-3" />
                          </a>
                        </Button>
                        {stripeUrl ? (
                          <Button variant="outline" size="sm" className="h-7 gap-1 px-2" asChild>
                            <a href={stripeUrl} target="_blank" rel="noopener noreferrer">
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
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
