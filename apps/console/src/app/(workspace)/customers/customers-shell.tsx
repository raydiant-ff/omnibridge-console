"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SidebarIcon, Search, Database } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { DataTable } from "@/components/ui/data-table";
import { customerDirectoryColumns } from "./columns";
import type { CustomerDirectoryRow, CustomerDirectoryTotals } from "@/lib/projections";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function fmtMrr(cents: number): string {
  if (cents === 0) return "—";
  const dollars = cents / 100;
  if (dollars >= 1_000_000) return `$${(dollars / 1_000_000).toFixed(1)}M`;
  if (dollars >= 1_000) return `$${(dollars / 1_000).toFixed(1)}K`;
  return `$${dollars.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Sync freshness indicator
// ---------------------------------------------------------------------------

function MirrorStatus() {
  return (
    <div className="flex items-center gap-1.5 text-muted-foreground/60">
      <Database className="size-3.5" />
      <span className="text-xs">Mirrored snapshot</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page intro
// ---------------------------------------------------------------------------

function PageIntro({ totals }: { totals: CustomerDirectoryTotals }) {
  const stats = [
    { label: "Total", value: totals.totalCustomers.toLocaleString() },
    { label: "Active", value: totals.activeCustomers.toLocaleString() },
    { label: "Salesforce", value: totals.sfAccountCount.toLocaleString() },
    { label: "Stripe", value: totals.stripeCustomerCount.toLocaleString() },
    { label: "MRR", value: fmtMrr(totals.totalMrrCents) },
    {
      label: "Renewing ≤90d",
      value: totals.renewingIn90d.toLocaleString(),
      warn: totals.renewingIn30d > 0 ? `${totals.renewingIn30d} ≤30d` : undefined,
    },
  ];

  return (
    <div className="border-b">
      {/* Title row */}
      <div className="flex items-start justify-between px-6 pt-6 pb-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customer accounts across Salesforce and Stripe
          </p>
        </div>
        <MirrorStatus />
      </div>

      {/* Stats row */}
      <div className="flex items-center px-6 pb-5 gap-0">
        {stats.map((stat, i) => (
          <div key={stat.label} className="flex items-center">
            {i > 0 && <div className="w-px h-7 bg-border mx-5" />}
            <div className="flex flex-col gap-0">
              <span className="text-xs text-muted-foreground leading-none">
                {stat.label}
              </span>
              <div className="flex items-baseline gap-1.5 mt-1.5">
                <span className="text-lg font-semibold tabular-nums leading-none">
                  {stat.value}
                </span>
                {stat.warn && (
                  <span className="text-xs text-destructive font-medium">{stat.warn}</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter sidebar
// ---------------------------------------------------------------------------

type StatusFilter = "active" | "all";
type SystemFilter = "all" | "both" | "sf_only" | "stripe_only";
type RenewalFilter = "all" | "30d" | "90d";

interface Filters {
  status: StatusFilter;
  system: SystemFilter;
  renewal: RenewalFilter;
  ae: string;
  csm: string;
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left text-sm rounded-sm px-2 py-1.5 transition-colors ${
        active
          ? "text-foreground font-medium bg-accent"
          : "text-muted-foreground hover:text-foreground hover:bg-accent/60"
      }`}
    >
      {children}
    </button>
  );
}

function FilterSidebar({ filters, onChange }: { filters: Filters; onChange: (f: Filters) => void }) {
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => onChange({ ...filters, [k]: v });

  return (
    <Sidebar className="top-(--header-height) h-[calc(100svh-var(--header-height))]!" collapsible="offcanvas">
      <SidebarContent className="gap-0 py-2">
        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-1">
            Status
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col px-2">
              {(
                [
                  { value: "active", label: "Active only" },
                  { value: "all", label: "All customers" },
                ] as { value: StatusFilter; label: string }[]
              ).map((o) => (
                <FilterButton key={o.value} active={filters.status === o.value} onClick={() => set("status", o.value)}>
                  {o.label}
                </FilterButton>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-3 my-1 w-auto" />

        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-1">
            Systems
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col px-2">
              {(
                [
                  { value: "all", label: "All" },
                  { value: "both", label: "Both systems" },
                  { value: "sf_only", label: "Salesforce only" },
                  { value: "stripe_only", label: "Stripe only" },
                ] as { value: SystemFilter; label: string }[]
              ).map((o) => (
                <FilterButton key={o.value} active={filters.system === o.value} onClick={() => set("system", o.value)}>
                  {o.label}
                </FilterButton>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-3 my-1 w-auto" />

        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-1">
            Renewal window
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-col px-2">
              {(
                [
                  { value: "all", label: "All" },
                  { value: "30d", label: "≤ 30 days" },
                  { value: "90d", label: "≤ 90 days" },
                ] as { value: RenewalFilter; label: string }[]
              ).map((o) => (
                <FilterButton key={o.value} active={filters.renewal === o.value} onClick={() => set("renewal", o.value)}>
                  {o.label}
                </FilterButton>
              ))}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <Separator className="mx-3 my-1 w-auto" />

        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-1">
            Account Executive
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 pb-1">
              <Input
                placeholder="Filter by AE…"
                value={filters.ae}
                onChange={(e) => set("ae", e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="py-2">
          <SidebarGroupLabel className="text-xs font-medium text-muted-foreground px-3 mb-1">
            CSM
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="px-3 pb-1">
              <Input
                placeholder="Filter by CSM…"
                value={filters.csm}
                onChange={(e) => set("csm", e.target.value)}
                className="h-7 text-xs"
              />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}

// ---------------------------------------------------------------------------
// Page header
// ---------------------------------------------------------------------------

function PageHeader({ query, onQueryChange }: { query: string; onQueryChange: (v: string) => void }) {
  const { toggleSidebar } = useSidebar();

  return (
    <header className="bg-white sticky top-10 z-40 flex h-10 shrink-0 items-center gap-2 border-b px-4">
      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleSidebar}>
        <SidebarIcon className="size-4" />
        <span className="sr-only">Toggle filters</span>
      </Button>
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage className="text-sm font-medium">Customers</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="ml-auto flex items-center max-w-xs w-full">
        <div className="relative w-full">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search customers…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="pl-8 h-7 text-xs border-0 bg-muted/50 focus-visible:bg-white focus-visible:border"
          />
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Search + filter logic
// ---------------------------------------------------------------------------

function matchesQuery(row: CustomerDirectoryRow, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    row.name.toLowerCase().includes(lower) ||
    (row.domain ?? "").toLowerCase().includes(lower) ||
    (row.aeName ?? "").toLowerCase().includes(lower) ||
    (row.csmName ?? "").toLowerCase().includes(lower) ||
    (row.accountStatus ?? "").toLowerCase().includes(lower) ||
    (row.accountType ?? "").toLowerCase().includes(lower) ||
    (row.stripeCustomerId ?? "").toLowerCase().includes(lower) ||
    (row.sfAccountId ?? "").toLowerCase().includes(lower) ||
    row.contractNumbers.some((n) => n.toLowerCase().includes(lower)) ||
    row.subscriptionIds.some((id) => id.toLowerCase().includes(lower))
  );
}

function matchesFilters(row: CustomerDirectoryRow, filters: Filters): boolean {
  if (filters.status === "active" && row.activeSubscriptionCount === 0 && row.activeContractCount === 0) return false;
  if (filters.system === "both" && !(row.hasSalesforce && row.hasStripe)) return false;
  if (filters.system === "sf_only" && !(row.hasSalesforce && !row.hasStripe)) return false;
  if (filters.system === "stripe_only" && !(!row.hasSalesforce && row.hasStripe)) return false;
  if (filters.renewal === "30d" && (row.daysToNearestRenewal === null || row.daysToNearestRenewal > 30)) return false;
  if (filters.renewal === "90d" && (row.daysToNearestRenewal === null || row.daysToNearestRenewal > 90)) return false;
  if (filters.ae && !(row.aeName ?? "").toLowerCase().includes(filters.ae.toLowerCase())) return false;
  if (filters.csm && !(row.csmName ?? "").toLowerCase().includes(filters.csm.toLowerCase())) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Shell
// ---------------------------------------------------------------------------

interface CustomersShellProps {
  rows: CustomerDirectoryRow[];
  totals: CustomerDirectoryTotals;
}

export function CustomersShell({ rows, totals }: CustomersShellProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>({
    status: "active",
    system: "all",
    renewal: "all",
    ae: "",
    csm: "",
  });

  const filtered = useMemo(
    () => rows.filter((r) => matchesQuery(r, query) && matchesFilters(r, filters)),
    [rows, query, filters],
  );

  return (
    <>
      <PageHeader query={query} onQueryChange={setQuery} />

      <div className="flex flex-1">
        <FilterSidebar filters={filters} onChange={setFilters} />

        <SidebarInset className="bg-white">
          <PageIntro totals={totals} />

          <div className="px-6 pt-4 pb-6">
            <DataTable
              columns={customerDirectoryColumns}
              data={filtered}
              entityName="customer"
              onRowClick={(row) => router.push(`/customers/${row.sfAccountId ?? row.id}/360`)}
            />
          </div>
        </SidebarInset>
      </div>
    </>
  );
}
