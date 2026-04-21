# (app) Route Group — File Tree

```
(app)/
├── layout.tsx
│
├── admin/
│   └── sync/
│       ├── page.tsx
│       ├── sync-actions.tsx
│       ├── sync-events-table.tsx
│       └── sync-jobs-table.tsx
│
├── contracts/
│   ├── page.tsx
│   └── [id]/
│       └── page.tsx
│
├── coupons/
│   ├── page.tsx
│   └── coupons-client.tsx
│
├── cs/
│   ├── page.tsx
│   └── renewals/
│       ├── page.tsx
│       ├── actions.ts
│       ├── renewals-dashboard.tsx
│       ├── [candidateId]/
│       │   └── page.tsx
│       ├── create/
│       │   ├── page.tsx
│       │   └── wizard.tsx
│       └── drafts/
│           ├── new/
│           │   └── page.tsx
│           └── [draftId]/
│               ├── page.tsx
│               └── draft-editor.tsx
│
├── customers/
│   ├── page.tsx
│   ├── loading.tsx
│   ├── accounts-table.tsx
│   ├── search-form.tsx
│   └── [id]/
│       ├── page.tsx
│       ├── customer-tabs.tsx
│       └── tabs/
│           ├── audit-tab.tsx
│           ├── overview-tab.tsx
│           ├── salesforce-tab.tsx
│           ├── stripe-tab.tsx
│           └── work-items-tab.tsx
│
├── opportunities/
│   ├── page.tsx
│   ├── loading.tsx
│   ├── dashboard-charts.tsx
│   ├── opportunities-table.tsx
│   ├── all/
│   │   └── page.tsx
│   ├── create/
│   │   └── page.tsx
│   └── my/
│       └── page.tsx
│
├── products/
│   ├── page.tsx
│   └── product-tabs.tsx
│
├── quotes/
│   ├── page.tsx
│   ├── loading.tsx
│   ├── quote-list-table.tsx
│   ├── all/
│   │   └── page.tsx
│   ├── [id]/
│   │   ├── page.tsx
│   │   └── quote-detail.tsx
│   ├── co-term/
│   │   ├── page.tsx
│   │   ├── wizard.tsx
│   │   ├── configure-co-term.tsx
│   │   └── review-co-term.tsx
│   └── create/
│       ├── page.tsx
│       ├── wizard.tsx
│       ├── amendment/
│       │   └── page.tsx
│       ├── expansion/
│       │   └── page.tsx
│       ├── renewal/
│       │   └── page.tsx
│       └── steps/
│           ├── configure-quote.tsx
│           ├── document-preview.tsx
│           ├── pick-bill-to-contact.tsx
│           ├── pick-customer.tsx
│           ├── pick-line-items.tsx
│           ├── pick-payment-path.tsx
│           ├── pick-subscription.tsx
│           ├── pick-terms.tsx
│           ├── pick-timing.tsx
│           ├── quote-success.tsx
│           └── review-quote.tsx
│
└── subscriptions/
    ├── page.tsx
    ├── loading.tsx
    ├── dashboard-section.tsx
    ├── dashboard-skeleton.tsx
    ├── cancellation/
    │   └── page.tsx
    ├── create/
    │   ├── page.tsx
    │   ├── wizard.tsx
    │   └── steps/
    │       ├── pick-billing.tsx
    │       ├── pick-customer.tsx
    │       ├── pick-dates.tsx
    │       ├── pick-prices.tsx
    │       ├── review.tsx
    │       └── success.tsx
    ├── cross-sell/
    │   └── page.tsx
    ├── customers/
    │   ├── page.tsx
    │   ├── search-form.tsx
    │   └── [id]/
    │       ├── page.tsx
    │       ├── customer-tabs.tsx
    │       └── tabs/
    │           ├── audit-tab.tsx
    │           ├── overview-tab.tsx
    │           ├── salesforce-tab.tsx
    │           ├── stripe-tab.tsx
    │           └── work-items-tab.tsx
    ├── downgrade/
    │   └── page.tsx
    ├── renewal/
    │   └── page.tsx
    └── upsell/
        └── page.tsx
```

---

# Source Code

## `admin/sync/page.tsx`

```tsx
export const dynamic = "force-dynamic";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SyncPageActions } from "./sync-actions";
import { SyncJobsTable } from "./sync-jobs-table";
import { SyncEventsTable } from "./sync-events-table";
import { getDataQualityReport } from "@/lib/queries/data-quality";

export default async function AdminSyncPage() {
  const session = await requireSession();
  const user = session.user as { role?: string };
  if (user.role !== "admin") redirect("/");

  const [
    recentJobs,
    recentEvents,
    // Stripe
    stripeCustomerTotal,
    stripeCustomerDelinquent,
    stripeProductTotal,
    stripeProductActive,
    stripePriceTotal,
    stripePriceActive,
    stripePriceStandard,
    stripeSubTotal,
    stripeSubActive,
    // Salesforce
    sfAccountTotal,
    sfContractTotal,
    sfContractActivated,
    sfContractLineTotal,
    sfContractLineActive,
    // Omni
    syncEventCount,
    quoteRecordTotal,
    auditLogCount,
    // System health
    failedJobCount,
    failedEventCount,
  ] = await Promise.all([
    prisma.syncJob.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.syncEvent.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
    // Stripe
    prisma.stripeCustomer.count(),
    prisma.stripeCustomer.count({ where: { delinquent: true } }),
    prisma.stripeProduct.count(),
    prisma.stripeProduct.count({ where: { active: true } }),
    prisma.stripePrice.count(),
    prisma.stripePrice.count({ where: { active: true } }),
    // Standard prices: default_price_id of active products that actually exist in the prices mirror
    prisma.$queryRaw<[{ count: bigint }]>`
      SELECT COUNT(*) AS count
      FROM stripe_prices p
      JOIN stripe_products pr ON pr.default_price_id = p.id AND pr.active = true
    `.then((r) => Number(r[0].count)),
    prisma.stripeSubscription.count(),
    prisma.stripeSubscription.count({ where: { status: { in: ["active", "trialing"] } } }),
    // Salesforce
    prisma.sfAccount.count(),
    prisma.sfContract.count(),
    prisma.sfContract.count({ where: { status: "Activated" } }),
    prisma.sfContractLine.count(),
    prisma.sfContractLine.count({ where: { status: "active" } }),
    // Omni
    prisma.syncEvent.count(),
    prisma.quoteRecord.count(),
    prisma.auditLog.count(),
    // System health
    prisma.syncJob.count({ where: { status: "failed" } }),
    prisma.syncEvent.count({ where: { success: false } }),
  ]);

  const quality = await getDataQualityReport();

  const stripeTotal = stripeCustomerTotal + stripeProductTotal + stripePriceTotal + stripeSubTotal;
  const sfTotal = sfAccountTotal + sfContractTotal + sfContractLineTotal;
  const omniTotal = syncEventCount + quoteRecordTotal + auditLogCount;
  const totalErrors = failedJobCount + failedEventCount;

  // Serialize dates for client components
  const serializedJobs = recentJobs.map((j) => ({
    ...j,
    startedAt: j.startedAt?.toISOString() ?? null,
    completedAt: j.completedAt?.toISOString() ?? null,
    createdAt: j.createdAt.toISOString(),
  }));

  const serializedEvents = recentEvents.map((e) => ({
    ...e,
    payload: undefined, // don't send raw payload to client
    createdAt: e.createdAt.toISOString(),
  }));

  return (
    <div className="flex flex-col gap-8">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sync Status</h1>
          <p className="text-sm text-muted-foreground">
            Mirror table health, coverage, and recent sync activity
          </p>
        </div>
        <SyncPageActions />
      </div>

      {/* ── Overview Row ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <OverviewCard
          label="Stripe Coverage"
          value={stripeTotal.toLocaleString()}
          detail="mirrored records across all entity types"
        />
        <OverviewCard
          label="Salesforce Coverage"
          value={sfTotal.toLocaleString()}
          detail="accounts, contracts, and contract lines"
        />
        <OverviewCard
          label="OmniBridge State"
          value={omniTotal.toLocaleString()}
          detail="events, quotes, and audit entries"
        />
        <OverviewCard
          label="System Health"
          value={totalErrors === 0 ? "Healthy" : `${totalErrors} error${totalErrors === 1 ? "" : "s"}`}
          detail={
            totalErrors === 0
              ? "No failed jobs or events"
              : `${failedJobCount} failed job${failedJobCount === 1 ? "" : "s"} · ${failedEventCount} failed event${failedEventCount === 1 ? "" : "s"}`
          }
          variant={totalErrors === 0 ? "default" : "warning"}
        />
      </div>

      {/* ── Stripe ── */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="Stripe" detail="Mirrored via webhooks and backfill" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Customers"
            value={stripeCustomerTotal}
            stats={[
              { label: "delinquent", value: stripeCustomerDelinquent, warn: stripeCustomerDelinquent > 0 },
            ]}
          />
          <MetricCard
            label="Products"
            value={stripeProductActive}
            stats={[
              { label: "total", value: stripeProductTotal },
              { label: "archived", value: stripeProductTotal - stripeProductActive },
            ]}
          />
          <MetricCard
            label="Prices"
            value={stripePriceStandard}
            stats={[
              { label: "total", value: stripePriceTotal },
              { label: "active", value: stripePriceActive },
              { label: "archived", value: stripePriceTotal - stripePriceActive },
            ]}
          />
          <MetricCard
            label="Subscriptions"
            value={stripeSubActive}
            stats={[
              { label: "total", value: stripeSubTotal },
              { label: "other", value: stripeSubTotal - stripeSubActive },
            ]}
          />
        </div>
      </section>

      {/* ── Salesforce ── */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="Salesforce" detail="Mirrored via backfill and cron sync" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            label="Accounts"
            value={sfAccountTotal - quality.accounts.stubs}
            stats={[
              { label: "total", value: sfAccountTotal },
              { label: "stubs", value: quality.accounts.stubs, warn: quality.accounts.stubs > 0 },
            ]}
          />
          <MetricCard
            label="Contracts"
            value={sfContractActivated}
            stats={[
              { label: "total", value: sfContractTotal },
              { label: "canceled", value: sfContractTotal - sfContractActivated },
            ]}
          />
          <MetricCard
            label="Contract Lines"
            value={sfContractLineActive}
            stats={[
              { label: "total", value: sfContractLineTotal },
              { label: "inactive", value: sfContractLineTotal - sfContractLineActive },
            ]}
          />
          <PendingCard label="Contacts" />
        </div>
      </section>

      {/* ── OmniBridge ── */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="OmniBridge" detail="Internal workflow and audit data" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <MetricCard label="Sync Events" value={syncEventCount} stats={[]} />
          <MetricCard label="Quote Records" value={quoteRecordTotal} stats={[]} />
          <MetricCard label="Audit Log" value={auditLogCount} stats={[]} />
        </div>
      </section>

      {/* ── Data Quality ── */}
      {quality.contracts.total > 0 && (
        <section className="flex flex-col gap-3">
          <SectionHeader title="Data Quality" detail="Contract integrity and linkage" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <QualityCard
              label="Contract Completeness"
              checks={[
                { label: "With start + end dates", value: quality.contracts.withDates, total: quality.contracts.total },
                { label: "With term populated", value: quality.contracts.withTerm, total: quality.contracts.total },
                { label: "With line items", value: quality.contracts.withLines, total: quality.contracts.total },
              ]}
            />
            <QualityCard
              label="Stripe Linkage"
              checks={[
                { label: "With subscription ID", value: quality.stripeLinkage.contractsWithSub, total: quality.contracts.total },
                { label: "Valid links (sub exists)", value: quality.stripeLinkage.validLinks, total: quality.stripeLinkage.contractsWithSub || 1 },
                { label: "Broken links", value: quality.stripeLinkage.brokenLinks, total: quality.stripeLinkage.contractsWithSub || 1, invert: true },
              ]}
            />
            <QualityCard
              label="Omni Linkage"
              checks={[
                { label: "Contracts from quotes", value: quality.omniLinkage.contractsLinkedFromQuote, total: quality.contracts.total },
                { label: "QuoteRecords with contract", value: quality.omniLinkage.quoteRecordsWithContract, total: quality.omniLinkage.quoteRecordsWithContract || 1 },
              ]}
            />
            <QualityCard
              label="Account Stubs"
              checks={[
                { label: "Stub accounts", value: quality.accounts.stubs, total: quality.accounts.total, invert: true },
                { label: "Hydrated accounts", value: quality.accounts.hydrated, total: quality.accounts.total },
                { label: "Orphaned lines", value: quality.contractLines.orphaned, total: quality.contractLines.total, invert: true },
              ]}
            />
          </div>
        </section>
      )}

      {/* ── Activity ── */}
      <SyncJobsTable jobs={serializedJobs} />
      <SyncEventsTable events={serializedEvents} />
    </div>
  );
}

/* ── Section Header ── */

function SectionHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <h2 className="text-base font-semibold tracking-tight">{title}</h2>
      <span className="text-xs text-muted-foreground">{detail}</span>
    </div>
  );
}

/* ── Overview Card ── */

function OverviewCard({
  label,
  value,
  detail,
  variant = "default",
}: {
  label: string;
  value: string;
  detail: string;
  variant?: "default" | "warning";
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={`mt-1 text-2xl font-semibold tabular-nums tracking-tight ${
            variant === "warning" ? "text-destructive" : ""
          }`}
        >
          {value}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

/* ── Metric Card ── */

function MetricCard({
  label,
  value,
  stats,
}: {
  label: string;
  value: number;
  stats: { label: string; value: number; warn?: boolean }[];
}) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {value.toLocaleString()}
        </p>
        {stats.length > 0 && (
          <p className="mt-1.5 text-xs text-muted-foreground">
            {stats.map((s, i) => (
              <span key={s.label}>
                {i > 0 && <span className="mx-1">·</span>}
                <span className={s.warn ? "text-destructive" : "tabular-nums"}>
                  {s.value.toLocaleString()}
                </span>
                {" "}{s.label}
              </span>
            ))}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Pending Card ── */

function PendingCard({ label }: { label: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="pt-4 pb-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-sm text-muted-foreground/60">Phase 1B</p>
      </CardContent>
    </Card>
  );
}

/* ── Quality Card ── */

function QualityCard({
  label,
  checks,
}: {
  label: string;
  checks: { label: string; value: number; total: number; invert?: boolean }[];
}) {
  return (
    <Card>
      <CardHeader className="pb-2 pt-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 pb-3">
        {checks.map((c) => {
          const pct = c.total > 0 ? Math.round((c.value / c.total) * 100) : 0;
          const isGood = c.invert ? c.value === 0 : pct >= 80;
          const isWarn = c.invert ? c.value > 0 : pct < 80 && pct >= 50;
          const isBad = c.invert ? c.value > c.total * 0.5 : pct < 50;
          return (
            <div key={c.label} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">{c.label}</span>
              <span
                className={`text-xs tabular-nums font-medium ${
                  isBad
                    ? "text-destructive"
                    : isWarn
                      ? "text-amber-600 dark:text-amber-400"
                      : isGood
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-muted-foreground"
                }`}
              >
                {c.value.toLocaleString()}{c.total > 1 && !c.invert ? ` / ${c.total.toLocaleString()}` : ""}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
```

## `admin/sync/sync-actions.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export function SyncPageActions() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
        disabled={isPending}
        onClick={() => startTransition(() => router.refresh())}
      >
        <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
        {isPending ? "Refreshing…" : "Refresh"}
      </Button>
    </div>
  );
}
```

## `admin/sync/sync-events-table.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SyncEvent {
  id: string;
  source: string;
  eventType: string;
  externalId: string | null;
  objectType: string | null;
  objectId: string | null;
  action: string | null;
  actorType: string | null;
  actorId: string | null;
  actorName: string | null;
  success: boolean;
  error: string | null;
  createdAt: string;
}

const SOURCE_TABS = ["all", "stripe", "salesforce", "omnibridge"] as const;
const STATUS_OPTIONS = ["all", "ok", "error"] as const;

export function SyncEventsTable({ events }: { events: SyncEvent[] }) {
  const [sourceTab, setSourceTab] = useState<string>("all");
  const [objectFilter, setObjectFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const objectTypes = Array.from(
    new Set(events.map((e) => e.objectType).filter(Boolean) as string[]),
  ).sort();

  const filtered = events.filter((evt) => {
    if (sourceTab !== "all" && evt.source !== sourceTab) return false;
    if (objectFilter !== "all" && evt.objectType !== objectFilter) return false;
    if (statusFilter === "ok" && !evt.success) return false;
    if (statusFilter === "error" && evt.success) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-medium">Recent Sync Events</CardTitle>
      </CardHeader>

      {/* Source Tabs */}
      <div className="border-b">
        <div className="flex">
          {SOURCE_TABS.map((tab) => {
            const count =
              tab === "all"
                ? events.length
                : events.filter((e) => e.source === tab).length;
            const isActive = sourceTab === tab;
            return (
              <button
                key={tab}
                className={`relative px-4 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? "text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                onClick={() => setSourceTab(tab)}
              >
                {tab === "all" ? "All" : tab.charAt(0).toUpperCase() + tab.slice(1)}
                {count > 0 && (
                  <span className="ml-1.5 tabular-nums text-muted-foreground">
                    {count}
                  </span>
                )}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-foreground" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters Row */}
      {events.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          {objectTypes.length > 1 && (
            <>
              <span className="text-xs text-muted-foreground">Object</span>
              <Button
                variant={objectFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setObjectFilter("all")}
              >
                All
              </Button>
              {objectTypes.map((t) => (
                <Button
                  key={t}
                  variant={objectFilter === t ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setObjectFilter(t)}
                >
                  {t}
                </Button>
              ))}
              <div className="mx-1 h-4 w-px bg-border" />
            </>
          )}
          <span className="text-xs text-muted-foreground">Status</span>
          {STATUS_OPTIONS.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : s === "ok" ? "OK" : "Error"}
            </Button>
          ))}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {filtered.length} of {events.length}
          </span>
        </div>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Event</TableHead>
                <TableHead className="text-xs">Object</TableHead>
                <TableHead className="text-xs">Action</TableHead>
                <TableHead className="text-xs">Actor</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    {events.length === 0
                      ? "No sync events yet — trigger a webhook to start."
                      : "No events match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((evt) => (
                  <TableRow key={evt.id}>
                    <TableCell>
                      <span className="font-mono text-xs">{evt.eventType}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {evt.objectType
                        ? `${evt.objectType}:${evt.objectId}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-xs">{evt.action ?? "—"}</TableCell>
                    <TableCell>
                      {evt.actorName ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-xs">{evt.actorName}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {evt.actorType}
                          </span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          {evt.actorType ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {evt.success ? (
                        <Badge variant="success" className="text-[10px]">
                          OK
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px]">
                          Error
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {evt.createdAt.replace("T", " ").slice(0, 19)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
```

## `admin/sync/sync-jobs-table.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface SyncJob {
  id: string;
  jobType: string;
  status: string;
  cursor: string | null;
  recordsProcessed: number;
  recordsCreated: number;
  recordsUpdated: number;
  recordsErrored: number;
  error: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

const STATUS_FILTERS = ["all", "completed", "running", "failed", "pending"] as const;

export function SyncJobsTable({ jobs }: { jobs: SyncJob[] }) {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const jobTypes = Array.from(new Set(jobs.map((j) => j.jobType)));
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const filtered = jobs.filter((job) => {
    if (statusFilter !== "all" && job.status !== statusFilter) return false;
    if (typeFilter !== "all" && job.jobType !== typeFilter) return false;
    return true;
  });

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle className="text-sm font-medium">Recent Sync Jobs</CardTitle>
        <CardDescription className="text-xs">
          {jobs.length === 0
            ? "No sync jobs recorded yet"
            : `${filtered.length} of ${jobs.length} jobs`}
        </CardDescription>
      </CardHeader>

      {/* Filters */}
      {jobs.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
          <span className="text-xs text-muted-foreground">Status</span>
          {STATUS_FILTERS.map((s) => (
            <Button
              key={s}
              variant={statusFilter === s ? "secondary" : "ghost"}
              size="sm"
              className="h-6 px-2 text-xs"
              onClick={() => setStatusFilter(s)}
            >
              {s === "all" ? "All" : s}
            </Button>
          ))}

          {jobTypes.length > 1 && (
            <>
              <div className="mx-1 h-4 w-px bg-border" />
              <span className="text-xs text-muted-foreground">Type</span>
              <Button
                variant={typeFilter === "all" ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => setTypeFilter("all")}
              >
                All
              </Button>
              {jobTypes.map((t) => (
                <Button
                  key={t}
                  variant={typeFilter === t ? "secondary" : "ghost"}
                  size="sm"
                  className="h-6 px-2 font-mono text-xs"
                  onClick={() => setTypeFilter(t)}
                >
                  {t}
                </Button>
              ))}
            </>
          )}
        </div>
      )}

      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Type</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-right text-xs">Processed</TableHead>
                <TableHead className="text-right text-xs">Created</TableHead>
                <TableHead className="text-right text-xs">Updated</TableHead>
                <TableHead className="text-right text-xs">Errors</TableHead>
                <TableHead className="text-xs">Duration</TableHead>
                <TableHead className="text-xs">Started</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="py-6 text-center text-xs text-muted-foreground"
                  >
                    {jobs.length === 0
                      ? "No sync jobs yet — run a backfill or wait for cron."
                      : "No jobs match the current filters."}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((job) => (
                  <TableRow key={job.id}>
                    <TableCell className="font-mono text-xs">{job.jobType}</TableCell>
                    <TableCell>
                      <StatusBadge status={job.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {job.recordsProcessed}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {job.recordsCreated}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {job.recordsUpdated}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-xs">
                      {job.recordsErrored > 0 ? (
                        <span className="text-destructive">{job.recordsErrored}</span>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {job.startedAt && job.completedAt
                        ? `${((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000).toFixed(1)}s`
                        : "—"}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {job.startedAt
                        ? job.startedAt.replace("T", " ").slice(0, 19)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === "completed"
      ? "success"
      : status === "running"
        ? "info"
        : status === "failed"
          ? "destructive"
          : "secondary";

  return (
    <Badge variant={variant as any} className="text-[10px]">
      {status}
    </Badge>
  );
}
```

## `contracts/[id]/page.tsx`

```tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getContractDetail } from "@/lib/queries/sf-contracts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ContractDetailPage({ params }: Props) {
  const { id } = await params;
  const contract = await getContractDetail(id);
  if (!contract) notFound();

  const statusVariant =
    contract.status === "Activated"
      ? "success"
      : contract.status === "canceled"
        ? "destructive"
        : contract.status === "Pending"
          ? "info"
          : "secondary";

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/contracts" className="hover:text-foreground">
          Contracts
        </Link>
        <span>/</span>
        <span className="text-foreground">
          {contract.contractNumber ?? contract.id.slice(0, 15)}
        </span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">
              {contract.accountName ?? "Contract"}
            </h1>
            <Badge variant={statusVariant as any} className="text-xs">
              {contract.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Contract #{contract.contractNumber ?? "—"}
            {contract.contractTerm ? ` · ${contract.contractTerm} month term` : ""}
            {contract.startDate ? ` · ${contract.startDate} → ${contract.endDate ?? "ongoing"}` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {contract.stripeSubscriptionId && (
            <a
              href={`https://dashboard.stripe.com/subscriptions/${contract.stripeSubscriptionId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Stripe ↗
            </a>
          )}
          <a
            href={`https://displai.lightning.force.com/lightning/r/Contract/${contract.id}/view`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            Salesforce ↗
          </a>
        </div>
      </div>

      {/* Detail Cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Contract Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Contract Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Account" value={contract.accountName} />
            <DetailRow label="Owner" value={contract.ownerName} />
            <DetailRow label="Start Date" value={contract.startDate} />
            <DetailRow label="End Date" value={contract.endDate} />
            <DetailRow label="Term" value={contract.contractTerm ? `${contract.contractTerm} months` : null} />
            <DetailRow label="Signed Date" value={contract.customerSignedDate} />
            <DetailRow label="Activated" value={contract.activatedDate?.slice(0, 10)} />
            <DetailRow label="Days to Expiry" value={contract.daysTillExpiry?.toString()} />
            <DetailRow label="Collection" value={contract.collectionMethod} />
            <DetailRow label="Evergreen" value={contract.evergreen ? "Yes" : "No"} />
            <DetailRow label="Do Not Renew" value={contract.doNotRenew ? "Yes" : "No"} />
          </CardContent>
        </Card>

        {/* Financial */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Financial</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow
              label="MRR"
              value={contract.mrr != null ? `$${contract.mrr.toLocaleString()}` : null}
            />
            <DetailRow
              label="ARR"
              value={contract.arr != null ? `$${contract.arr.toLocaleString()}` : null}
            />
            <DetailRow label="Lines" value={contract.lines.length.toString()} />
          </CardContent>
        </Card>

        {/* Stripe Link */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Stripe Integration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <DetailRow label="Subscription" value={contract.stripeSubscriptionId} mono />
            <DetailRow label="Customer" value={contract.stripeCustomerId} mono />
            <DetailRow label="Stripe Status" value={contract.stripeStatus} />
            <DetailRow label="Schedule" value={contract.stripeScheduleId} mono />
            {contract.stripeSubscription && (
              <>
                <div className="border-t pt-2 mt-2">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Live Subscription</p>
                  <DetailRow label="Status" value={contract.stripeSubscription.status} />
                  <DetailRow
                    label="Period End"
                    value={contract.stripeSubscription.currentPeriodEnd.slice(0, 10)}
                  />
                  <DetailRow
                    label="Cancel at End"
                    value={contract.stripeSubscription.cancelAtPeriodEnd ? "Yes" : "No"}
                  />
                </div>
              </>
            )}
            {contract.quoteRecord && (
              <div className="border-t pt-2 mt-2">
                <p className="text-xs font-medium text-muted-foreground mb-1">Omni Quote</p>
                <DetailRow label="Type" value={contract.quoteRecord.quoteType} />
                <DetailRow label="Status" value={contract.quoteRecord.status} />
                <DetailRow
                  label="Created"
                  value={contract.quoteRecord.createdAt.slice(0, 10)}
                />
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sync Metadata */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span>Last SF modified: {contract.sfLastModified?.slice(0, 19).replace("T", " ") ?? "—"}</span>
        <span>·</span>
        <span>Synced at: {contract.syncedAt.slice(0, 19).replace("T", " ")}</span>
      </div>

      {/* Contract Lines */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm font-medium">Contract Lines</CardTitle>
          <CardDescription className="text-xs">
            {contract.lines.length} line item{contract.lines.length !== 1 ? "s" : ""} (SBQQ Subscriptions)
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-right text-xs">Qty</TableHead>
                  <TableHead className="text-right text-xs">List Price</TableHead>
                  <TableHead className="text-right text-xs">Net Price</TableHead>
                  <TableHead className="text-right text-xs">MRR</TableHead>
                  <TableHead className="text-xs">Billing</TableHead>
                  <TableHead className="text-xs">Start</TableHead>
                  <TableHead className="text-xs">End</TableHead>
                  <TableHead className="text-xs">Stripe Price</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.lines.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-6 text-center text-xs text-muted-foreground"
                    >
                      No contract lines found.
                    </TableCell>
                  </TableRow>
                ) : (
                  contract.lines.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {line.productName ?? "—"}
                      </TableCell>
                      <TableCell>
                        {line.status ? (
                          <LineStatusBadge status={line.status} />
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {line.quantity ?? "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {line.listPrice != null ? `$${line.listPrice.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {line.netPrice != null ? `$${line.netPrice.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {line.mrr != null ? `$${line.mrr.toLocaleString()}` : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {line.billingFrequency ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {line.startDate ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {line.endDate ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {line.stripePriceId ? (
                          <span className="max-w-[120px] truncate block">{line.stripePriceId}</span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
}) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right ${mono ? "font-mono" : ""} ${value ? "" : "text-muted-foreground"}`}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function LineStatusBadge({ status }: { status: string }) {
  const variant =
    status === "active"
      ? "success"
      : status === "canceled"
        ? "destructive"
        : status === "past_due"
          ? "warning"
          : "secondary";

  return (
    <Badge variant={variant as any} className="text-[10px]">
      {status}
    </Badge>
  );
}
```

## `contracts/page.tsx`

```tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { getContracts } from "@/lib/queries/sf-contracts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  searchParams: Promise<{ status?: string; q?: string }>;
}

export default async function ContractsPage({ searchParams }: Props) {
  const { status, q } = await searchParams;
  const contracts = await getContracts({
    status: status ?? "all",
    search: q?.trim() || undefined,
  });

  const statusCounts = contracts.reduce(
    (acc, c) => {
      acc[c.status] = (acc[c.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Contracts</h1>
        <p className="text-sm text-muted-foreground">
          Salesforce contracts mirrored to Omni
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total" value={contracts.length} />
        <SummaryCard label="Activated" value={statusCounts["Activated"] ?? 0} />
        <SummaryCard label="Canceled" value={statusCounts["canceled"] ?? 0} />
        <SummaryCard
          label="Pending / Draft"
          value={(statusCounts["Pending"] ?? 0) + (statusCounts["Draft"] ?? 0)}
        />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">Status</span>
        {["all", "Activated", "canceled", "Pending", "Draft"].map((s) => (
          <Link
            key={s}
            href={`/contracts${s !== "all" ? `?status=${s}` : ""}${q ? `${s !== "all" ? "&" : "?"}q=${q}` : ""}`}
            className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
              (status ?? "all") === s
                ? "bg-secondary font-medium text-secondary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {s === "all" ? "All" : s}
          </Link>
        ))}
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="border-b pb-3">
          <CardTitle className="text-sm font-medium">Contracts</CardTitle>
          <CardDescription className="text-xs">
            {contracts.length} contract{contracts.length !== 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Contract #</TableHead>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Start</TableHead>
                  <TableHead className="text-xs">End</TableHead>
                  <TableHead className="text-xs">Term</TableHead>
                  <TableHead className="text-right text-xs">MRR</TableHead>
                  <TableHead className="text-right text-xs">ARR</TableHead>
                  <TableHead className="text-right text-xs">Lines</TableHead>
                  <TableHead className="text-xs">Stripe Sub</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={10}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No contracts found. Run the backfill script to sync from Salesforce.
                    </TableCell>
                  </TableRow>
                ) : (
                  contracts.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell>
                        <Link
                          href={`/contracts/${c.id}`}
                          className="font-mono text-xs text-primary hover:underline"
                        >
                          {c.contractNumber ?? c.id.slice(0, 15)}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-xs">
                        {c.accountName ?? "—"}
                      </TableCell>
                      <TableCell>
                        <ContractStatusBadge status={c.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {c.startDate ?? "—"}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {c.endDate ?? "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {c.contractTerm ? `${c.contractTerm}mo` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {c.mrr ? `$${c.mrr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {c.arr ? `$${c.arr.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-xs">
                        {c.lineCount}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {c.stripeSubscriptionId ? (
                          <span className="max-w-[140px] truncate block">
                            {c.stripeSubscriptionId}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">
          {value.toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );
}

function ContractStatusBadge({ status }: { status: string }) {
  const variant =
    status === "Activated"
      ? "success"
      : status === "canceled"
        ? "destructive"
        : status === "Pending"
          ? "info"
          : "secondary";

  return (
    <Badge variant={variant as any} className="text-[10px]">
      {status}
    </Badge>
  );
}
```

## `coupons/coupons-client.tsx`

```tsx
"use client";

import { useState, useTransition, useMemo } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Ticket,
  Trash2,
  Loader2,
  Plus,
  Search,
  Percent,
  DollarSign,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import type { StripeCoupon } from "@/lib/queries/stripe-coupons";
import { createCoupon, deleteCoupon } from "@/lib/actions/coupons";
import { formatDate } from "@/lib/format";

interface Props {
  initialCoupons: StripeCoupon[];
}

export function CouponsClient({ initialCoupons }: Props) {
  const { data: session } = useSession();
  const isAdmin =
    (session?.user as { role?: string } | undefined)?.role === "admin";
  const router = useRouter();

  const [coupons] = useState(initialCoupons);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);

  const filtered = useMemo(() => {
    if (!search) return coupons;
    const q = search.toLowerCase();
    return coupons.filter(
      (c) =>
        c.id.toLowerCase().includes(q) ||
        (c.name ?? "").toLowerCase().includes(q),
    );
  }, [coupons, search]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search coupons..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        {isAdmin && (
          <Button onClick={() => setShowCreate(!showCreate)}>
            <Plus className="mr-1.5 size-4" />
            Create Coupon
          </Button>
        )}
      </div>

      {showCreate && isAdmin && (
        <CreateCouponForm
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            setShowCreate(false);
            router.refresh();
          }}
        />
      )}

      <Card>
        <CardHeader className="border-b">
          <CardTitle>Coupons ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name / ID</TableHead>
                <TableHead>Discount</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Redemptions</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Applies To</TableHead>
                <TableHead>Created</TableHead>
                {isAdmin && <TableHead className="w-12" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={isAdmin ? 8 : 7}
                    className="py-8 text-center text-sm text-muted-foreground"
                  >
                    No coupons found.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((c) => (
                  <CouponRow
                    key={c.id}
                    coupon={c}
                    isAdmin={isAdmin}
                    onDeleted={() => router.refresh()}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function CouponRow({
  coupon,
  isAdmin,
  onDeleted,
}: {
  coupon: StripeCoupon;
  isAdmin: boolean;
  onDeleted: () => void;
}) {
  const [deleting, startDelete] = useTransition();

  function handleDelete() {
    if (!confirm(`Delete coupon "${coupon.name ?? coupon.id}"? This cannot be undone.`))
      return;
    startDelete(async () => {
      const result = await deleteCoupon(coupon.id);
      if (result.success) onDeleted();
      else alert(result.error);
    });
  }

  const discountLabel = coupon.percentOff
    ? `${coupon.percentOff}% off`
    : coupon.amountOff
      ? `$${(coupon.amountOff / 100).toFixed(2)} off`
      : "—";

  const durationLabel =
    coupon.duration === "forever"
      ? "Forever"
      : coupon.duration === "once"
        ? "Once"
        : `${coupon.durationInMonths} months`;

  return (
    <TableRow>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">
            {coupon.name ?? "Unnamed"}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            {coupon.id}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">
          {coupon.percentOff ? (
            <Percent className="mr-1 size-3" />
          ) : (
            <DollarSign className="mr-1 size-3" />
          )}
          {discountLabel}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">{durationLabel}</TableCell>
      <TableCell className="text-sm tabular-nums">
        {coupon.timesRedeemed}
        {coupon.maxRedemptions ? ` / ${coupon.maxRedemptions}` : ""}
      </TableCell>
      <TableCell>
        <Badge variant={coupon.valid ? "default" : "secondary"}>
          {coupon.valid ? "Active" : "Expired"}
        </Badge>
      </TableCell>
      <TableCell className="text-sm">
        {coupon.appliesTo && coupon.appliesTo.length > 0
          ? `${coupon.appliesTo.length} product${coupon.appliesTo.length > 1 ? "s" : ""}`
          : "All products"}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(coupon.created)}
      </TableCell>
      {isAdmin && (
        <TableCell>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Trash2 className="size-3.5" />
            )}
          </Button>
        </TableCell>
      )}
    </TableRow>
  );
}

function CreateCouponForm({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"percent" | "fixed">("percent");
  const [percentOff, setPercentOff] = useState("");
  const [amountOff, setAmountOff] = useState("");
  const [duration, setDuration] = useState<"once" | "forever" | "repeating">(
    "once",
  );
  const [durationInMonths, setDurationInMonths] = useState("");
  const [maxRedemptions, setMaxRedemptions] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await createCoupon({
        name,
        type,
        percentOff: type === "percent" ? Number(percentOff) : undefined,
        amountOff:
          type === "fixed" ? Math.round(Number(amountOff) * 100) : undefined,
        currency: "usd",
        duration,
        durationInMonths:
          duration === "repeating" ? Number(durationInMonths) : undefined,
        maxRedemptions: maxRedemptions ? Number(maxRedemptions) : undefined,
      });
      if (result.success) {
        onCreated();
      } else {
        setError(result.error ?? "Failed to create coupon.");
      }
    });
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>New Coupon</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="coupon-name">Coupon Name</Label>
            <Input
              id="coupon-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 20% Launch Discount"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Discount Type</Label>
            <Select
              value={type}
              onValueChange={(v) => setType(v as "percent" | "fixed")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="percent">Percentage (%)</SelectItem>
                <SelectItem value="fixed">Fixed Amount ($)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {type === "percent" ? (
            <div className="space-y-1.5">
              <Label htmlFor="percent-off">Percent Off</Label>
              <Input
                id="percent-off"
                type="number"
                min={1}
                max={100}
                value={percentOff}
                onChange={(e) => setPercentOff(e.target.value)}
                placeholder="e.g. 20"
                required
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label htmlFor="amount-off">Amount Off (USD)</Label>
              <Input
                id="amount-off"
                type="number"
                min={0.01}
                step={0.01}
                value={amountOff}
                onChange={(e) => setAmountOff(e.target.value)}
                placeholder="e.g. 50.00"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Duration</Label>
            <Select
              value={duration}
              onValueChange={(v) =>
                setDuration(v as "once" | "forever" | "repeating")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Once</SelectItem>
                <SelectItem value="forever">Forever</SelectItem>
                <SelectItem value="repeating">Repeating</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {duration === "repeating" && (
            <div className="space-y-1.5">
              <Label htmlFor="duration-months">Duration (months)</Label>
              <Input
                id="duration-months"
                type="number"
                min={1}
                value={durationInMonths}
                onChange={(e) => setDurationInMonths(e.target.value)}
                placeholder="e.g. 3"
                required
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="max-redemptions">
              Max Redemptions{" "}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Input
              id="max-redemptions"
              type="number"
              min={1}
              value={maxRedemptions}
              onChange={(e) => setMaxRedemptions(e.target.value)}
              placeholder="Unlimited"
            />
          </div>

          {error && (
            <div className="text-sm text-destructive sm:col-span-2">
              {error}
            </div>
          )}

          <div className="flex gap-2 sm:col-span-2">
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
              Create Coupon
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
```

## `coupons/page.tsx`

```tsx
import { fetchStripeCoupons } from "@/lib/queries/stripe-coupons";
import { CouponsClient } from "./coupons-client";

export default async function CouponsPage() {
  const coupons = await fetchStripeCoupons();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Coupon Manager</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage Stripe coupons that can be applied via the Quote
          Manager.
        </p>
      </div>
      <CouponsClient initialCoupons={coupons} />
    </div>
  );
}
```

## `cs/page.tsx`

```tsx
import Link from "next/link";
import {
  Users,
  RefreshCw,
  DollarSign,
  AlertTriangle,
  TrendingDown,
  CalendarClock,
  ArrowRight,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getCsDashboardKpis } from "@/lib/queries/cs-dashboard";

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function monthLabel(offset: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return d.toLocaleDateString("en-US", { month: "long" });
}

export default async function CsDashboardPage() {
  let kpis: Awaited<ReturnType<typeof getCsDashboardKpis>> | null = null;
  let error: string | null = null;

  try {
    kpis = await getCsDashboardKpis();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load dashboard.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Customer Success
          </h1>
          <p className="text-sm text-muted-foreground">
            Account health overview and subscription lifecycle management.
          </p>
        </div>
        <Button asChild>
          <Link href="/cs/renewals">
            View Renewals
            <ArrowRight className="ml-1 size-4" />
          </Link>
        </Button>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : kpis ? (
        <>
          {/* Row 1: Core KPIs */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              title="Active Accounts"
              value={kpis.activeAccounts.toLocaleString()}
              icon={<Users className="size-4 text-muted-foreground" />}
            />
            <KpiCard
              title="Active Subscriptions"
              value={kpis.activeSubscriptions.toLocaleString()}
              icon={<RefreshCw className="size-4 text-muted-foreground" />}
            />
            <KpiCard
              title="Active MRR"
              value={fmtCurrency(kpis.activeMrr)}
              icon={<DollarSign className="size-4 text-muted-foreground" />}
            />
            <KpiCard
              title="Past Due"
              value={kpis.pastDueCount.toLocaleString()}
              subtitle={fmtCurrency(kpis.pastDueRevenue) + " MRR at risk"}
              icon={<AlertTriangle className="size-4 text-amber-500" />}
              variant={kpis.pastDueCount > 0 ? "warning" : "default"}
            />
          </div>

          {/* Row 2: Churn & Renewals */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <KpiCard
              title="Churning"
              value={kpis.churningCount.toLocaleString()}
              subtitle={fmtCurrency(kpis.churningRevenue) + " MRR at risk"}
              icon={<TrendingDown className="size-4 text-destructive" />}
              variant={kpis.churningCount > 0 ? "destructive" : "default"}
            />
            <KpiCard
              title={`Expiring ${monthLabel(0)}`}
              value={kpis.expiringThisMonth.toLocaleString()}
              subtitle={fmtCurrency(kpis.expiringThisMonthRevenue) + " MRR"}
              icon={<CalendarClock className="size-4 text-amber-500" />}
              variant={kpis.expiringThisMonth > 0 ? "warning" : "default"}
            />
            <KpiCard
              title={`Expiring ${monthLabel(1)}`}
              value={kpis.expiringNextMonth.toLocaleString()}
              subtitle={fmtCurrency(kpis.expiringNextMonthRevenue) + " MRR"}
              icon={<CalendarClock className="size-4 text-muted-foreground" />}
            />
          </div>

          {/* Quick links */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button variant="outline" size="sm" asChild>
                <Link href="/cs/renewals">Renewals Dashboard</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/subscriptions">Subscriptions Dashboard</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/quotes/create">Create Quote</Link>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <Link href="/customers">Customer Lookup</Link>
              </Button>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  variant?: "default" | "warning" | "destructive";
}) {
  const borderClass =
    variant === "warning"
      ? "border-amber-500/30"
      : variant === "destructive"
        ? "border-destructive/30"
        : "";

  return (
    <Card className={borderClass}>
      <CardContent className="flex items-start gap-4 pt-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
          {icon}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

## `cs/renewals/[candidateId]/page.tsx`

```tsx
export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { getRenewalDetail } from "@/lib/queries/cs-renewals";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ExternalLink,
  RotateCw,
  AlertTriangle,
} from "lucide-react";

interface Props {
  params: Promise<{ candidateId: string }>;
}

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtDollars(amount: number | null): string {
  if (amount == null) return "";
  return `$${amount.toLocaleString()}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default async function RenewalDetailPage({ params }: Props) {
  const { candidateId } = await params;
  const decoded = decodeURIComponent(candidateId);
  const detail = await getRenewalDetail(decoded);
  if (!detail) notFound();

  const { candidate: c, contractLines, account } = detail;

  // The working renewal path — always use this
  const renewUrl = `/cs/renewals/create?sub=${encodeURIComponent(c.id)}&customer=${encodeURIComponent(c.customerId)}`;

  // Compute risk signals
  const risks: string[] = [];
  if (c.renewalStatus === "cancelling") risks.push("Cancelling");
  if (c.contract?.doNotRenew) risks.push("Do Not Renew");
  if (c.status === "past_due") risks.push("Past Due");
  if (c.hasSchedule) risks.push("Schedule Active");

  // Collect non-empty detail pairs for the context section
  const contextRows: [string, string][] = [];
  contextRows.push(["Due Date", fmtDate(c.dueDate)]);
  contextRows.push(["Due Basis", c.dueBasis === "contract" ? "Contract End" : "Subscription End"]);
  if (c.contract?.startDate && c.contract?.endDate) {
    contextRows.push(["Contract Term", `${c.contract.startDate} \u2192 ${c.contract.endDate}`]);
  }
  if (c.contract?.contractTerm) {
    contextRows.push(["Term Length", `${c.contract.contractTerm} months`]);
  }
  if (c.cancelAtPeriodEnd) contextRows.push(["Cancel Signal", "Cancel at period end"]);
  if (c.cancelAt) contextRows.push(["Cancel At", fmtDate(c.cancelAt)]);
  if (c.contract?.evergreen) contextRows.push(["Evergreen", "Yes"]);
  const collectionLabel = c.collectionMethod === "send_invoice" ? "Invoice" : "Auto-charge";
  contextRows.push(["Collection", collectionLabel]);

  return (
    <div className="flex flex-col gap-4">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/cs/renewals" className="hover:text-foreground">
          Renewals
        </Link>
        <span>/</span>
        <span className="text-foreground">{c.customerName}</span>
      </div>

      {/* Summary header — compact, all key info on one line */}
      <div className="flex items-start justify-between gap-4 rounded-lg border px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
          <div>
            <p className="text-xs text-muted-foreground">Account</p>
            <p className="text-sm font-semibold">{c.customerName}</p>
          </div>
          {c.contract?.contractNumber && (
            <div>
              <p className="text-xs text-muted-foreground">Contract</p>
              <p className="text-sm font-medium">{c.contract.contractNumber}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">Due</p>
            <p className="text-sm font-medium">{fmtDate(c.dueDate)}</p>
          </div>
          {(c.csmName || account?.csmName) && (
            <div>
              <p className="text-xs text-muted-foreground">CSM</p>
              <p className="text-sm font-medium">{c.csmName ?? account?.csmName}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-muted-foreground">MRR</p>
            <p className="font-mono text-sm font-semibold">{fmtCurrency(c.mrr)}</p>
          </div>
          <div className="flex items-center gap-2">
            <RenewalStatusBadge status={c.renewalStatus} />
            {c.contract && (
              <Badge
                variant={c.contract.status === "Activated" ? "outline" : "secondary"}
                className="text-[10px]"
              >
                {c.contract.status}
              </Badge>
            )}
          </div>
        </div>
        <Button size="sm" className="shrink-0" asChild>
          <Link href={renewUrl}>
            <RotateCw className="mr-1 size-3" />
            Prepare Renewal Quote
          </Link>
        </Button>
      </div>

      {/* Risk alerts (only if there are any) */}
      {risks.length > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm">
          <AlertTriangle className="size-3.5 shrink-0 text-amber-500" />
          <span className="text-amber-700 dark:text-amber-400">
            {risks.join(" \u00b7 ")}
          </span>
        </div>
      )}

      {/* Two-column layout: Context + Linked Records */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* A. Current Renewal Context */}
        <div className="rounded-lg border">
          <div className="border-b px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Renewal Context
            </p>
          </div>
          <div className="space-y-0 divide-y text-sm">
            {contextRows.map(([label, value]) => (
              <div key={label} className="flex justify-between px-3 py-1.5">
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            ))}
            {c.contract?.mrr != null && (
              <div className="flex justify-between px-3 py-1.5">
                <span className="text-muted-foreground">Contract MRR</span>
                <span className="font-medium">{fmtDollars(c.contract.mrr)}</span>
              </div>
            )}
            {c.contract?.arr != null && (
              <div className="flex justify-between px-3 py-1.5">
                <span className="text-muted-foreground">Contract ARR</span>
                <span className="font-medium">{fmtDollars(c.contract.arr)}</span>
              </div>
            )}
          </div>
        </div>

        {/* C. Linked Records */}
        <div className="rounded-lg border">
          <div className="border-b px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Linked Records
            </p>
          </div>
          <div className="space-y-0 divide-y text-sm">
            {account && (
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-muted-foreground">Account</span>
                <span className="font-medium">{account.name}</span>
              </div>
            )}
            {(account?.ownerName || c.contract?.ownerName) && (
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-muted-foreground">Account Owner</span>
                <span className="font-medium">{account?.ownerName ?? c.contract?.ownerName}</span>
              </div>
            )}
            {c.contract && (
              <div className="flex items-center justify-between px-3 py-1.5">
                <span className="text-muted-foreground">SF Contract</span>
                <a
                  href={`https://displai.lightning.force.com/lightning/r/Contract/${c.contract.id}/view`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                  {c.contract.contractNumber ?? c.contract.id.slice(0, 15)}
                  <ExternalLink className="size-3" />
                </a>
              </div>
            )}
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-muted-foreground">Stripe Subscription</span>
              <a
                href={`https://dashboard.stripe.com/subscriptions/${c.id}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {c.id.slice(0, 24)}
                <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-muted-foreground">Stripe Customer</span>
              <a
                href={`https://dashboard.stripe.com/customers/${c.customerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
              >
                {c.customerId.slice(0, 24)}
                <ExternalLink className="size-3" />
              </a>
            </div>
            <div className="flex items-center justify-between px-3 py-1.5">
              <span className="text-muted-foreground">Sub Status</span>
              <span className="font-medium">{c.status}</span>
            </div>
            {!c.contract && (
              <div className="px-3 py-1.5 text-xs text-muted-foreground">
                No Salesforce contract linked
              </div>
            )}
          </div>
        </div>
      </div>

      {/* B. Current Products — Stripe subscription items */}
      {c.items.length > 0 && (
        <div className="rounded-lg border">
          <div className="border-b px-3 py-2">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Current Products
              <span className="ml-2 font-normal normal-case text-muted-foreground">
                {c.items.length} item{c.items.length !== 1 ? "s" : ""}
              </span>
            </p>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-right text-xs">Qty</TableHead>
                <TableHead className="text-right text-xs">Unit Price</TableHead>
                <TableHead className="text-xs">Interval</TableHead>
                <TableHead className="text-right text-xs">MRR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {c.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="text-sm">{item.productName}</TableCell>
                  <TableCell className="text-right tabular-nums text-sm">{item.quantity}</TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtCurrency(item.unitAmount)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {item.interval
                      ? `${item.interval}${item.intervalCount > 1 ? ` x${item.intervalCount}` : ""}`
                      : "one-time"}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {fmtCurrency(item.mrr)}/mo
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="bg-muted/30">
                <TableCell colSpan={4} className="text-right text-xs font-medium text-muted-foreground">
                  Total MRR
                </TableCell>
                <TableCell className="text-right font-mono text-sm font-semibold">
                  {fmtCurrency(c.mrr)}/mo
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      )}

      {/* Contract Lines — only show if they add value beyond sub items */}
      {contractLines.length > 0 && (
        <details className="rounded-lg border">
          <summary className="cursor-pointer border-b px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
            Contract Lines (Salesforce)
            <span className="ml-2 font-normal normal-case">
              {contractLines.length} line{contractLines.length !== 1 ? "s" : ""}
            </span>
          </summary>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Product</TableHead>
                <TableHead className="text-right text-xs">Qty</TableHead>
                <TableHead className="text-right text-xs">Net Price</TableHead>
                <TableHead className="text-right text-xs">MRR</TableHead>
                <TableHead className="text-xs">Billing</TableHead>
                <TableHead className="text-xs">Period</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contractLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="max-w-[200px] truncate text-xs">
                    {line.productName || ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.quantity ?? ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.netPrice != null ? fmtDollars(line.netPrice) : ""}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-xs">
                    {line.mrr != null ? fmtDollars(line.mrr) : ""}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {line.billingFrequency || ""}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {[line.startDate, line.endDate].filter(Boolean).join(" \u2192 ")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </details>
      )}

      {/* Bottom CTA */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          Launch the renewal wizard pre-filled with current subscription data.
        </p>
        <Button asChild>
          <Link href={renewUrl}>
            <RotateCw className="mr-1 size-3" />
            Prepare Renewal Quote
          </Link>
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function RenewalStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; variant: string }> = {
    cancelling: { label: "Cancelling", variant: "destructive" },
    scheduled_end: { label: "Schedule Ending", variant: "secondary" },
    period_ending: { label: "Period Ending", variant: "outline" },
  };
  const cfg = config[status] ?? { label: status, variant: "secondary" };
  return (
    <Badge variant={cfg.variant as "destructive" | "secondary" | "outline"} className="text-[10px]">
      {cfg.label}
    </Badge>
  );
}
```

## `cs/renewals/actions.ts`

```tsx
"use server";

import { requireSession } from "@omnibridge/auth";
import {
  getRenewalCandidates,
  getRenewalDetail,
  type RenewalsDashboardData,
  type RenewalDetailData,
} from "@/lib/queries/cs-renewals";

export async function fetchRenewalsForMonth(
  month: string,
  csm: string | null = null,
): Promise<RenewalsDashboardData> {
  await requireSession();

  if (!/^\d{4}-\d{2}$/.test(month)) {
    throw new Error("Invalid month format. Expected YYYY-MM.");
  }

  return getRenewalCandidates(month, csm);
}

export async function fetchRenewalDetail(
  candidateId: string,
): Promise<RenewalDetailData | null> {
  await requireSession();

  if (!candidateId || (!candidateId.startsWith("sub:") && !candidateId.startsWith("contract:"))) {
    throw new Error("Invalid candidate ID format.");
  }

  return getRenewalDetail(candidateId);
}
```

## `cs/renewals/create/page.tsx`

```tsx
import { prisma } from "@omnibridge/db";
import { notFound } from "next/navigation";
import { getCustomerSubscriptions } from "@/lib/queries/customer-subscriptions";
import { RenewalWizard } from "./wizard";
import type { QuoteLineItem } from "@/lib/actions/quotes";
import type { QuoteWizardState, QuoteCustomer } from "@/app/(app)/quotes/create/wizard";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";

interface Props {
  searchParams: Promise<{ sub?: string; customer?: string }>;
}

function mapBillingInterval(
  interval: string | null,
  intervalCount: number,
): BillingFrequency {
  if (!interval) return "monthly";
  if (interval === "year" && intervalCount === 1) return "annual";
  if (interval === "year" && intervalCount === 2) return "2yr";
  if (interval === "year" && intervalCount === 3) return "3yr";
  if (interval === "month" && intervalCount === 3) return "quarterly";
  if (interval === "month" && intervalCount === 6) return "semi_annual";
  return "monthly";
}

export default async function RenewalCreatePage({ searchParams }: Props) {
  const { sub: subscriptionId, customer: customerId } = await searchParams;

  if (!subscriptionId) notFound();

  const subscription = await prisma.stripeSubscription.findUnique({
    where: { id: subscriptionId },
    include: { items: true },
  });

  if (!subscription) notFound();

  const customerIndex = await prisma.customerIndex.findFirst({
    where: { stripeCustomerId: subscription.customerId },
  });

  let liveItems: QuoteLineItem[] = [];
  try {
    const liveSubs = await getCustomerSubscriptions(subscription.customerId);
    const liveSub = liveSubs.find((s) => s.id === subscriptionId);
    if (liveSub) {
      liveItems = liveSub.items.map((item) => ({
        priceId: item.priceId,
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        nickname: item.productName,
        unitAmount: item.unitAmount,
        currency: item.currency,
        interval: item.interval ?? "month",
        sfProductId: null,
      }));
    }
  } catch {
    // Fall back to mirror data if Stripe API fails
  }

  if (liveItems.length === 0 && subscription.items.length > 0) {
    liveItems = subscription.items.map((item) => ({
      priceId: item.priceId,
      productId: item.productId,
      productName: item.productName,
      quantity: item.quantity,
      nickname: item.productName,
      unitAmount: item.unitAmount,
      currency: item.currency,
      interval: item.billingInterval ?? "month",
      sfProductId: null,
    }));
  }

  const contractTerm: ContractTerm =
    (subscription.metadata as Record<string, string>)?.contract_term as ContractTerm ?? "1yr";

  const firstItem = subscription.items[0];
  const billingFrequency = firstItem
    ? mapBillingInterval(firstItem.billingInterval, firstItem.intervalCount)
    : "monthly";

  const collectionMethod =
    subscription.collectionMethod === "send_invoice"
      ? "send_invoice" as const
      : "charge_automatically" as const;

  const customer: QuoteCustomer | null = customerIndex
    ? {
        id: customerIndex.id,
        sfAccountId: customerIndex.sfAccountId,
        sfAccountName: customerIndex.sfAccountName,
        stripeCustomerId: customerIndex.stripeCustomerId,
        domain: customerIndex.domain,
      }
    : null;

  const initialState: Partial<QuoteWizardState> = {
    customer,
    lineItems: liveItems,
    contractTerm,
    billingFrequency,
    collectionMethod,
    dryRun: true,
  };

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Renewal Quote
        </h1>
        <p className="text-sm text-muted-foreground">
          Renewing subscription for{" "}
          <span className="font-medium text-foreground">
            {subscription.customerName}
          </span>
          {" "}— pre-populated with current subscription products. Modify as needed.
        </p>
      </div>
      <RenewalWizard
        initialState={initialState}
        subscriptionId={subscriptionId}
        customerName={subscription.customerName}
      />
    </div>
  );
}
```

## `cs/renewals/create/wizard.tsx`

```tsx
"use client";

import { RotateCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  QuoteWizard,
  type QuoteWizardState,
} from "@/app/(app)/quotes/create/wizard";

interface Props {
  initialState: Partial<QuoteWizardState>;
  subscriptionId: string;
  customerName: string;
}

export function RenewalWizard({ initialState, subscriptionId, customerName }: Props) {
  const startStep = initialState.customer ? 2 : 0;

  return (
    <QuoteWizard
      initialState={initialState}
      initialStep={startStep}
      storageKey={`renewal-wizard-${subscriptionId}`}
      badge={
        <Badge
          variant="secondary"
          className="mr-2 gap-1 text-xs"
        >
          <RotateCw className="size-3" />
          Renewal — {customerName}
        </Badge>
      }
    />
  );
}
```

## `cs/renewals/drafts/[draftId]/draft-editor.tsx`

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import {
  RotateCw,
  Trash2,
  Plus,
  FileSignature,
  Zap,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DraftLineItem {
  id: string;
  productName: string;
  unitAmount: number;
  currency: string;
  interval: string | null;
  intervalCount: number;
  quantity: number;
  mrr: number;
  discount: number; // percentage 0-100
  overrideUnitAmount: number | null;
}

interface RenewalDraft {
  id: string;
  candidateId: string;
  subscriptionId: string;
  customerId: string;
  customerName: string;
  csmName: string | null;
  sfAccountId: string | null;
  sfContractId: string | null;
  contractNumber: string | null;
  lineItems: DraftLineItem[];
  contractTerm: string;
  billingFrequency: string;
  collectionMethod: string;
  effectiveDate: string;
  notes: string;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function computeMrr(
  unitAmount: number,
  interval: string | null,
  intervalCount: number,
  quantity: number,
): number {
  if (!interval) return 0;
  let months = 1;
  switch (interval) {
    case "year":
      months = intervalCount * 12;
      break;
    case "month":
      months = intervalCount;
      break;
    case "week":
      months = intervalCount / 4;
      break;
    case "day":
      months = intervalCount / 30;
      break;
  }
  if (months <= 0) return 0;
  return Math.round((unitAmount * quantity) / months);
}

function effectivePrice(item: DraftLineItem): number {
  const base = item.overrideUnitAmount ?? item.unitAmount;
  if (item.discount > 0) {
    return Math.round(base * (1 - item.discount / 100));
  }
  return base;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DraftEditor({ initialDraft }: { initialDraft: RenewalDraft }) {
  const [draft, setDraft] = useState<RenewalDraft>(initialDraft);
  const [confirmDialog, setConfirmDialog] = useState<"auto" | "signature" | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  function updateField<K extends keyof RenewalDraft>(key: K, value: RenewalDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setIsSaved(false);
  }

  function updateLineItem(index: number, updates: Partial<DraftLineItem>) {
    setDraft((d) => {
      const items = [...d.lineItems];
      const item = { ...items[index], ...updates };
      // Recompute MRR with effective price
      const price = effectivePrice(item);
      item.mrr = computeMrr(price, item.interval, item.intervalCount, item.quantity);
      items[index] = item;
      return { ...d, lineItems: items };
    });
    setIsSaved(false);
  }

  function removeLineItem(index: number) {
    setDraft((d) => ({
      ...d,
      lineItems: d.lineItems.filter((_, i) => i !== index),
    }));
    setIsSaved(false);
  }

  function addBlankLineItem() {
    setDraft((d) => ({
      ...d,
      lineItems: [
        ...d.lineItems,
        {
          id: `new-${Date.now()}`,
          productName: "New Product",
          unitAmount: 0,
          currency: "usd",
          interval: "month",
          intervalCount: 1,
          quantity: 1,
          mrr: 0,
          discount: 0,
          overrideUnitAmount: null,
        },
      ],
    }));
    setIsSaved(false);
  }

  async function saveDraft() {
    // Persist to cookie via API call
    try {
      await fetch(`/api/renewals/drafts/${draft.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      setIsSaved(true);
    } catch {
      // Fail silently for demo
    }
  }

  // Compute totals
  const totalMrr = draft.lineItems.reduce((sum, item) => {
    const price = effectivePrice(item);
    return sum + computeMrr(price, item.interval, item.intervalCount, item.quantity);
  }, 0);
  const totalArr = totalMrr * 12;

  // Build the renewal wizard URL for "Quote for Signature" path
  const renewWizardUrl = `/cs/renewals/create?sub=${encodeURIComponent(draft.subscriptionId)}&customer=${encodeURIComponent(draft.customerId)}`;

  return (
    <div className="flex flex-col gap-6">
      {/* Draft metadata */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Contract Term */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Contract Term</Label>
          <Select
            value={draft.contractTerm}
            onValueChange={(v) => updateField("contractTerm", v)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mtm">Month-to-Month</SelectItem>
              <SelectItem value="1yr">1 Year</SelectItem>
              <SelectItem value="2yr">2 Years</SelectItem>
              <SelectItem value="3yr">3 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Billing Frequency */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Billing Frequency</Label>
          <Select
            value={draft.billingFrequency}
            onValueChange={(v) => updateField("billingFrequency", v)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="semi_annual">Semi-Annual</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
              <SelectItem value="2yr">Every 2 Years</SelectItem>
              <SelectItem value="3yr">Every 3 Years</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Effective Date */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Effective Date</Label>
          <Input
            type="date"
            value={draft.effectiveDate.slice(0, 10)}
            onChange={(e) => updateField("effectiveDate", e.target.value)}
            className="h-8 text-sm"
          />
        </div>

        {/* Collection Method */}
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Collection</Label>
          <Select
            value={draft.collectionMethod}
            onValueChange={(v) => updateField("collectionMethod", v)}
          >
            <SelectTrigger size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="charge_automatically">Auto-Charge</SelectItem>
              <SelectItem value="send_invoice">Send Invoice</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Line items table */}
      <Card>
        <CardHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-sm font-medium">Line Items</CardTitle>
              <CardDescription className="text-xs">
                {draft.lineItems.length} item{draft.lineItems.length !== 1 ? "s" : ""} &middot;
                Pre-filled from Stripe subscription
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={addBlankLineItem} className="h-7 text-xs">
              <Plus className="mr-1 size-3" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Product</TableHead>
                  <TableHead className="w-[80px] text-right text-xs">Qty</TableHead>
                  <TableHead className="w-[120px] text-right text-xs">Unit Price</TableHead>
                  <TableHead className="w-[120px] text-right text-xs">Override Price</TableHead>
                  <TableHead className="w-[80px] text-right text-xs">Discount %</TableHead>
                  <TableHead className="w-[100px] text-right text-xs">Effective</TableHead>
                  <TableHead className="w-[100px] text-right text-xs">MRR</TableHead>
                  <TableHead className="w-[40px] text-xs" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {draft.lineItems.map((item, idx) => (
                  <LineItemRow
                    key={item.id}
                    item={item}
                    onUpdate={(updates) => updateLineItem(idx, updates)}
                    onRemove={() => removeLineItem(idx)}
                  />
                ))}
                {draft.lineItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8} className="py-8 text-center text-xs text-muted-foreground">
                      No line items. Add at least one to continue.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Internal Notes</Label>
        <textarea
          value={draft.notes}
          onChange={(e) => updateField("notes", e.target.value)}
          placeholder="Add renewal notes, context, or instructions..."
          rows={3}
          className="w-full rounded-md border bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      {/* Summary + Actions */}
      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-4">
        <div className="flex items-center gap-6">
          <div>
            <p className="text-xs text-muted-foreground">Total MRR</p>
            <p className="text-lg font-bold tabular-nums">{fmtCurrency(totalMrr)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total ARR</p>
            <p className="text-lg font-bold tabular-nums">{fmtCurrency(totalArr)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Items</p>
            <p className="text-lg font-bold tabular-nums">{draft.lineItems.length}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={saveDraft}
            disabled={isSaved}
          >
            <Save className="mr-1 size-3" />
            {isSaved ? "Saved" : "Save Draft"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmDialog("auto")}
            disabled={draft.lineItems.length === 0}
          >
            <Zap className="mr-1 size-3" />
            Automatic Renewal
          </Button>

          <Button
            size="sm"
            onClick={() => setConfirmDialog("signature")}
            disabled={draft.lineItems.length === 0}
          >
            <FileSignature className="mr-1 size-3" />
            Quote for Signature
          </Button>
        </div>
      </div>

      {/* Confirmation dialogs */}
      <Dialog open={confirmDialog === "auto"} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="size-4" />
              Automatic Renewal
            </DialogTitle>
            <DialogDescription>
              This will process the renewal automatically using the current draft configuration.
              The subscription will be renewed with the line items, pricing, and terms shown in the draft.
              No customer signature is required.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{draft.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Term</span>
                <span>{termLabel(draft.contractTerm)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective</span>
                <span>{draft.effectiveDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MRR</span>
                <span className="font-mono">{fmtCurrency(totalMrr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span>{draft.lineItems.length}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button asChild>
              <Link href={renewWizardUrl}>
                <Zap className="mr-1 size-3" />
                Proceed to Renewal
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDialog === "signature"} onOpenChange={(open) => !open && setConfirmDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSignature className="size-4" />
              Quote for Signature
            </DialogTitle>
            <DialogDescription>
              This will create a formal renewal quote that can be sent to the customer for
              review and electronic signature via DocuSign. The quote will include the line items,
              pricing, and terms from this draft.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-md border bg-muted/30 p-3 text-sm">
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer</span>
                <span className="font-medium">{draft.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Term</span>
                <span>{termLabel(draft.contractTerm)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Effective</span>
                <span>{draft.effectiveDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">MRR</span>
                <span className="font-mono">{fmtCurrency(totalMrr)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Items</span>
                <span>{draft.lineItems.length}</span>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDialog(null)}>
              Cancel
            </Button>
            <Button asChild>
              <Link href={renewWizardUrl}>
                <FileSignature className="mr-1 size-3" />
                Create Quote
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Line item row
// ---------------------------------------------------------------------------

function LineItemRow({
  item,
  onUpdate,
  onRemove,
}: {
  item: DraftLineItem;
  onUpdate: (updates: Partial<DraftLineItem>) => void;
  onRemove: () => void;
}) {
  const effective = effectivePrice(item);

  return (
    <TableRow>
      <TableCell>
        <Input
          value={item.productName}
          onChange={(e) => onUpdate({ productName: e.target.value })}
          className="h-7 border-0 bg-transparent px-0 text-sm shadow-none focus-visible:ring-0"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min={1}
          value={item.quantity}
          onChange={(e) => onUpdate({ quantity: Math.max(1, parseInt(e.target.value) || 1) })}
          className="h-7 w-[70px] text-right text-sm"
        />
      </TableCell>
      <TableCell className="text-right font-mono text-xs text-muted-foreground">
        {fmtCurrency(item.unitAmount)}
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          step={1}
          placeholder="\u2014"
          value={item.overrideUnitAmount != null ? item.overrideUnitAmount / 100 : ""}
          onChange={(e) => {
            const val = e.target.value;
            onUpdate({
              overrideUnitAmount: val ? Math.round(parseFloat(val) * 100) : null,
            });
          }}
          className="h-7 w-[100px] text-right text-sm"
        />
      </TableCell>
      <TableCell className="text-right">
        <Input
          type="number"
          min={0}
          max={100}
          step={1}
          value={item.discount || ""}
          placeholder="0"
          onChange={(e) =>
            onUpdate({ discount: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)) })
          }
          className="h-7 w-[60px] text-right text-sm"
        />
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {effective !== item.unitAmount ? (
          <span className="text-emerald-600">{fmtCurrency(effective)}</span>
        ) : (
          fmtCurrency(effective)
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {fmtCurrency(computeMrr(effective, item.interval, item.intervalCount, item.quantity))}/mo
      </TableCell>
      <TableCell>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-sm p-1 text-muted-foreground hover:text-destructive"
        >
          <Trash2 className="size-3.5" />
        </button>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function termLabel(term: string): string {
  const labels: Record<string, string> = {
    mtm: "Month-to-Month",
    "1yr": "1 Year",
    "2yr": "2 Years",
    "3yr": "3 Years",
  };
  return labels[term] ?? term;
}
```

## `cs/renewals/drafts/[draftId]/page.tsx`

```tsx
export const dynamic = "force-dynamic";

import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { DraftEditor } from "./draft-editor";

interface Props {
  params: Promise<{ draftId: string }>;
}

export default async function DraftPage({ params }: Props) {
  const { draftId } = await params;

  // Load draft from cookie
  const jar = await cookies();
  const raw = jar.get(`renewal-draft-${draftId}`)?.value;
  if (!raw) notFound();

  let draft;
  try {
    draft = JSON.parse(raw);
  } catch {
    notFound();
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/cs/renewals" className="hover:text-foreground">
          Renewals
        </Link>
        <span>/</span>
        <Link
          href={`/cs/renewals/${encodeURIComponent(draft.candidateId)}`}
          className="hover:text-foreground"
        >
          {draft.customerName}
        </Link>
        <span>/</span>
        <span className="text-foreground">Draft</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Renewal Draft
        </h1>
        <p className="text-sm text-muted-foreground">
          Renewing{" "}
          <span className="font-medium text-foreground">{draft.customerName}</span>
          {draft.contractNumber && <> &middot; Contract #{draft.contractNumber}</>}
          {draft.csmName && <> &middot; CSM: {draft.csmName}</>}
        </p>
      </div>

      <DraftEditor initialDraft={draft} />
    </div>
  );
}
```

## `cs/renewals/drafts/new/page.tsx`

```tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * /cs/renewals/drafts/new?candidateId=sub:xxx
 *
 * Client page that calls the draft creation API and redirects to the draft editor.
 */
export default function NewDraftPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const candidateId = searchParams.get("candidateId");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidateId) {
      router.replace("/cs/renewals");
      return;
    }

    let cancelled = false;

    async function createDraft() {
      try {
        const res = await fetch("/api/renewals/drafts/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Failed to create draft");
        }

        const { draftId } = await res.json();
        if (!cancelled) {
          router.replace(`/cs/renewals/drafts/${draftId}`);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to create draft");
        }
      }
    }

    createDraft();

    return () => {
      cancelled = true;
    };
  }, [candidateId, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center gap-4 py-24">
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
        <a href="/cs/renewals" className="text-sm text-primary hover:underline">
          Back to Renewals
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3 py-24">
      <Loader2 className="size-6 animate-spin text-muted-foreground" />
      <p className="text-sm text-muted-foreground">Creating renewal draft...</p>
    </div>
  );
}
```

## `cs/renewals/page.tsx`

```tsx
import { getRenewalCandidates } from "@/lib/queries/cs-renewals";
import { RenewalsDashboard } from "./renewals-dashboard";

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function RenewalsPage() {
  const month = currentMonth();
  let data: Awaited<ReturnType<typeof getRenewalCandidates>> | null = null;
  let error: string | null = null;

  try {
    data = await getRenewalCandidates(month, null);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load renewals.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Renewals Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Contracts due for renewal. Filter by month and CSM.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : data ? (
        <RenewalsDashboard initialMonth={month} initialData={data} />
      ) : null}
    </div>
  );
}
```

## `cs/renewals/renewals-dashboard.tsx`

```tsx
"use client";

import { useState, useTransition } from "react";
import {
  ChevronLeft,
  ChevronRight,
  RotateCw,
  CalendarClock,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
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
import type {
  RenewalsDashboardData,
  RenewalCandidate,
  Signal,
} from "@/lib/queries/cs-renewals";
import { fetchRenewalsForMonth } from "./actions";

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function fmtDate(iso: string): string {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m - 1).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Signal config
// ---------------------------------------------------------------------------

const SIGNAL_CONFIG: Record<
  Signal,
  { label: string; variant: "destructive" | "secondary" | "outline"; className: string }
> = {
  past_due: {
    label: "Past Due",
    variant: "destructive",
    className: "",
  },
  due_soon: {
    label: "Due Soon",
    variant: "secondary",
    className: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  upcoming: {
    label: "Upcoming",
    variant: "outline",
    className: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  },
};

type SortField = "mrr" | "dueDate" | "customerName" | "csmName";
type SortDir = "asc" | "desc";

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function RenewalsDashboard({
  initialMonth,
  initialData,
}: {
  initialMonth: string;
  initialData: RenewalsDashboardData;
}) {
  const [month, setMonth] = useState(initialMonth);
  const [csm, setCsm] = useState<string>("__all__");
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();
  const [sortField, setSortField] = useState<SortField>("mrr");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function refresh(nextMonth: string, nextCsm: string) {
    setMonth(nextMonth);
    setCsm(nextCsm);
    startTransition(async () => {
      const csmParam = nextCsm === "__all__" ? null : nextCsm;
      const result = await fetchRenewalsForMonth(nextMonth, csmParam);
      setData(result);
    });
  }

  function navigateMonth(delta: number) {
    refresh(shiftMonth(month, delta), csm);
  }

  function changeCsm(value: string) {
    refresh(month, value);
  }

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "customerName" || field === "csmName" ? "asc" : "desc");
    }
  }

  function sortCandidates(list: RenewalCandidate[]) {
    return [...list].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "mrr":
          cmp = a.mrr - b.mrr; break;
        case "dueDate":
          cmp = new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); break;
        case "customerName":
          cmp = a.customerName.localeCompare(b.customerName); break;
        case "csmName":
          cmp = (a.csmName ?? "").localeCompare(b.csmName ?? ""); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  const sorted = sortCandidates(data.candidates);
  const { summary } = data;

  return (
    <div className="flex flex-col gap-6">
      {/* Controls row */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Month picker */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => navigateMonth(-1)}
            disabled={isPending}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="min-w-[150px] text-center text-sm font-medium">
            {isPending ? (
              <Loader2 className="mx-auto size-4 animate-spin" />
            ) : (
              monthLabel(month)
            )}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="size-8"
            onClick={() => navigateMonth(1)}
            disabled={isPending}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>

        {/* CSM filter — always visible */}
        <div className="flex items-center gap-2">
          <User className="size-3.5 text-muted-foreground" />
          <Select value={csm} onValueChange={changeCsm} disabled={isPending}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue placeholder="All CSMs" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All CSMs</SelectItem>
              <SelectItem value="__unassigned__">Unassigned</SelectItem>
              {data.csmList.map((name) => (
                <SelectItem key={name} value={name}>
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary cards — actionable contracts only */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          title="Actionable Renewals"
          value={summary.total}
          sub={`Activated contracts in ${monthLabel(month)}`}
          icon={<CalendarClock className="size-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Renewing MRR"
          value={fmtCurrency(summary.totalMrr)}
          sub={`${summary.total} actionable contract${summary.total !== 1 ? "s" : ""}`}
          icon={<CreditCard className="size-4 text-muted-foreground" />}
        />
        <SummaryCard
          title="Auto-Renew"
          value={summary.autoRenewCount}
          sub="evergreen / no cancel signal"
          icon={<CheckCircle2 className="size-4 text-emerald-500" />}
        />
        <SummaryCard
          title="Review Needed"
          value={summary.reviewNeededCount}
          sub="cancelling or past due"
          icon={<AlertTriangle className="size-4 text-amber-500" />}
          highlight={summary.reviewNeededCount > 0}
        />
      </div>

      {/* Overdue section — separate from month table */}
      {data.overdue.length > 0 && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 border-b border-red-500/20 px-4 py-2">
            <AlertTriangle className="size-4 text-red-500" />
            <p className="text-sm font-medium text-red-700 dark:text-red-400">
              {data.overdue.length} Overdue Contract{data.overdue.length !== 1 ? "s" : ""}
            </p>
            <span className="text-xs text-red-600/70 dark:text-red-400/70">
              Activated contracts past end date — require immediate action
            </span>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Account</TableHead>
                  <TableHead className="text-xs">CSM</TableHead>
                  <TableHead className="text-xs">Contract #</TableHead>
                  <TableHead className="text-xs">End Date</TableHead>
                  <TableHead className="text-right text-xs">MRR</TableHead>
                  <TableHead className="text-xs" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.overdue.map((c) => (
                  <OverdueRow key={c.candidateId} candidate={c} />
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Main month table */}
      {sorted.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12">
            <RotateCw className="size-8 text-muted-foreground" />
            <p className="text-sm font-medium">No contracts due</p>
            <p className="text-xs text-muted-foreground">
              No contracts are ending in {monthLabel(month)}
              {csm !== "__all__" ? ` for ${csm === "__unassigned__" ? "unassigned" : csm}` : ""}.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label="Account"
                  field="customerName"
                  current={sortField}
                  dir={sortDir}
                  onToggle={toggleSort}
                />
                <SortableHead
                  label="CSM"
                  field="csmName"
                  current={sortField}
                  dir={sortDir}
                  onToggle={toggleSort}
                />
                <TableHead className="text-xs">Contract #</TableHead>
                <TableHead className="text-xs">Contract</TableHead>
                <SortableHead
                  label="Due Date"
                  field="dueDate"
                  current={sortField}
                  dir={sortDir}
                  onToggle={toggleSort}
                />
                <TableHead className="text-xs">Signal</TableHead>
                <TableHead className="text-xs">Subscription</TableHead>
                <SortableHead
                  label="MRR"
                  field="mrr"
                  current={sortField}
                  dir={sortDir}
                  onToggle={toggleSort}
                  className="text-right"
                />
                <TableHead className="text-right text-xs">Items</TableHead>
                <TableHead className="text-xs" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((c) => (
                <RenewalRow key={c.candidateId} candidate={c} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table rows
// ---------------------------------------------------------------------------

function RenewalRow({ candidate: c }: { candidate: RenewalCandidate }) {
  const signalCfg = SIGNAL_CONFIG[c.signal];
  const itemCount = c.items.length || c.contract?.lineCount || 0;
  const detailHref = `/cs/renewals/${encodeURIComponent(c.candidateId)}`;
  const isCanceled = c.contract?.status === "canceled";

  return (
    <TableRow className={`group cursor-pointer transition-colors hover:bg-muted/30 ${isCanceled ? "opacity-60" : ""}`}>
      <TableCell className="text-sm font-medium">
        <a
          href={detailHref}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
          onClick={(e) => e.stopPropagation()}
        >
          {c.customerName}
        </a>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {c.csmName || "\u2014"}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {c.contract?.contractNumber || ""}
      </TableCell>
      <TableCell>
        {c.contract ? (
          <Badge
            variant={c.contract.status === "Activated" ? "outline" : "secondary"}
            className="text-[10px]"
          >
            {c.contract.status}
          </Badge>
        ) : (
          ""
        )}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm">
        {fmtDate(c.dueDate)}
      </TableCell>
      <TableCell>
        <Badge
          variant={signalCfg.variant}
          className={`text-[10px] ${signalCfg.className}`}
        >
          {signalCfg.label}
        </Badge>
      </TableCell>
      <TableCell>
        {c.subscriptionStatus ? (
          <Badge
            variant={c.subscriptionStatus === "active" ? "outline" : "secondary"}
            className="text-[10px]"
          >
            {c.subscriptionStatus}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">No sub</span>
        )}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {fmtCurrency(c.mrr)}
      </TableCell>
      <TableCell className="text-right text-xs text-muted-foreground">
        {itemCount > 0 ? itemCount : ""}
      </TableCell>
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          asChild
        >
          <a href={detailHref} target="_blank" rel="noopener noreferrer">
            View
            <ExternalLink className="ml-1 size-3" />
          </a>
        </Button>
      </TableCell>
    </TableRow>
  );
}

function OverdueRow({ candidate: c }: { candidate: RenewalCandidate }) {
  const detailHref = `/cs/renewals/${encodeURIComponent(c.candidateId)}`;
  return (
    <TableRow className="hover:bg-red-500/5">
      <TableCell className="text-sm font-medium">
        <a
          href={detailHref}
          target="_blank"
          rel="noopener noreferrer"
          className="hover:underline"
        >
          {c.customerName}
        </a>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {c.csmName || "\u2014"}
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {c.contract?.contractNumber || ""}
      </TableCell>
      <TableCell className="whitespace-nowrap text-sm text-red-600 dark:text-red-400">
        {fmtDate(c.dueDate)}
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {fmtCurrency(c.mrr)}
      </TableCell>
      <TableCell>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          asChild
        >
          <a href={detailHref} target="_blank" rel="noopener noreferrer">
            View
            <ExternalLink className="ml-1 size-3" />
          </a>
        </Button>
      </TableCell>
    </TableRow>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function SummaryCard({
  title,
  value,
  sub,
  icon,
  highlight,
}: {
  title: string;
  value: number | string;
  sub: string;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-amber-500/30" : ""}>
      <CardContent className="flex flex-col gap-1 pt-6">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{title}</p>
          {icon}
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function SortableHead({
  label,
  field,
  current,
  dir,
  onToggle,
  className = "",
}: {
  label: string;
  field: SortField;
  current: SortField;
  dir: SortDir;
  onToggle: (f: SortField) => void;
  className?: string;
}) {
  const isActive = current === field;
  return (
    <TableHead className={`text-xs ${className}`}>
      <button
        type="button"
        onClick={() => onToggle(field)}
        className="flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {isActive && (
          <span className="text-[10px]">{dir === "asc" ? "\u2191" : "\u2193"}</span>
        )}
      </button>
    </TableHead>
  );
}
```

## `customers/[id]/customer-tabs.tsx`

```tsx
// Re-export from shared location — this file can be deleted once all imports are updated.
export { CustomerTabs } from "@/components/customer/customer-tabs";
export type { WorkItemWithRelations, AuditLogWithActor } from "@/components/customer/customer-tabs";
```

## `customers/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight, ExternalLink } from "lucide-react";
import { getAccountDetailById } from "@/lib/queries/customers";
import { getStripeCustomerDetail } from "@/lib/queries/stripe-customer-detail";
import type { StripeCustomerDetail } from "@/lib/queries/stripe-customer-detail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  params: Promise<{ id: string }>;
}

function fmtCurrency(amount: number | null | undefined, currency = "usd"): string {
  if (amount === null || amount === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function fmtCents(amount: number, currency = "usd"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatAddress(addr: {
  street: string | null;
  city: string | null;
  state: string | null;
  postalCode: string | null;
  country: string | null;
}): string | null {
  const parts = [
    addr.street,
    [addr.city, addr.state].filter(Boolean).join(", "),
    addr.postalCode,
    addr.country,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join("\n") : null;
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "active":
    case "succeeded":
    case "paid":
      return "default";
    case "trialing":
    case "open":
    case "processing":
    case "requires_action":
      return "secondary";
    case "canceled":
    case "cancelled":
    case "failed":
    case "requires_payment_method":
    case "uncollectible":
    case "void":
      return "destructive";
    default:
      return "outline";
  }
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;

  const account = await getAccountDetailById(id);
  if (!account) notFound();

  const stripeDetail = await getStripeCustomerDetail(account.stripeCustomerId);

  const sfBase = process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://yourorg.lightning.force.com";
  const sfUrl = `${sfBase}/lightning/r/Account/${account.id}/view`;
  const stripeUrl = account.stripeCustomerId
    ? `https://dashboard.stripe.com/customers/${account.stripeCustomerId}`
    : null;

  const shippingFormatted = formatAddress(account.shippingAddress);
  const billingFormatted = formatAddress(account.billingAddress);

  return (
    <div className="flex flex-col gap-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link
          href="/customers"
          className="transition-colors hover:text-foreground"
        >
          Customers
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="font-medium text-foreground">{account.name}</span>
      </nav>

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {account.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[account.industry, account.type].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 px-2" asChild>
            <a href={sfUrl} target="_blank" rel="noopener noreferrer">
              { /* eslint-disable-next-line @next/next/no-img-element */ }
              <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-6 w-auto" />
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
          {stripeUrl ? (
            <Button variant="outline" size="sm" className="gap-1.5 px-2" asChild>
              <a href={stripeUrl} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/images/stripe-logo.svg" alt="Stripe" className="h-6 w-auto" />
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" className="px-2 opacity-30" disabled>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/images/stripe-logo.svg" alt="Stripe" className="h-6 w-auto opacity-30" />
            </Button>
          )}
        </div>
      </div>

      {/* ────── Salesforce ────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-7 w-auto" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <Section title="Details">
            <Field label="Name" value={account.name} />
            <Field label="Links">
              <LinkButtons sfUrl={sfUrl} stripeUrl={stripeUrl} />
            </Field>
            <Field
              label="First Closed Won"
              value={fmtDate(account.dateOfFirstClosedWon)}
            />
            <Field label="Account Value (MRR)">
              <span className="font-mono">
                {fmtCurrency(account.accountValue)}
              </span>
            </Field>
            <Field label="Total ARR">
              <span className="font-mono">
                {fmtCurrency(account.totalArr)}
              </span>
            </Field>
            <Field label="Lifetime Value">
              <span className="font-mono">
                {fmtCurrency(account.lifetimeValue)}
              </span>
            </Field>
          </Section>

          <Section title="AR">
            <Field label="Outstanding AR">
              <span className="font-mono">
                {fmtCurrency(account.outstandingAr)}
              </span>
            </Field>
            <Field label="AR Status">
              {account.arStatus ? (
                <Badge
                  variant={
                    account.arStatus === "Current" ? "default" : "destructive"
                  }
                >
                  {account.arStatus}
                </Badge>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </Section>

          <Section title="Contacts & Addresses">
            <Field label="Primary Contact" value={account.primaryContactName} />
            <Field
              label="Primary Contact Email"
              value={account.primaryContactEmail}
            />
            <Field label="Dashboard Email" value={account.dashboardEmail} />
            <Field label="Bill To Contact" value={account.billToContactName} />
            <Field label="Bill To Email" value={account.billToEmail} />
            <Field label="Shipping Address">
              {shippingFormatted ? (
                <span className="whitespace-pre-line text-sm">
                  {shippingFormatted}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Billing Address">
              {billingFormatted ? (
                <span className="whitespace-pre-line text-sm">
                  {billingFormatted}
                </span>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </Section>

          <Section title="Customer Success">
            <Field label="Account Notes">
              {account.accountNotes ? (
                <p className="whitespace-pre-wrap text-sm">
                  {account.accountNotes}
                </p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
            <Field label="Additional Notes" value={account.churnDetails} />
            <Field label="AR Notes" value={account.arNotes} />
            <Field label="CSM Health Update">
              {account.latestHealthUpdate ? (
                <p className="whitespace-pre-wrap text-sm">
                  {account.latestHealthUpdate}
                </p>
              ) : (
                <span className="text-muted-foreground">—</span>
              )}
            </Field>
          </Section>
        </div>
      </div>

      {/* ────── Stripe ────── */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/stripe-logo.svg" alt="Stripe" className="h-7 w-auto" />
        </div>
        {!stripeDetail ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
            <p className="text-sm font-medium">No Stripe data available</p>
            <p className="text-sm text-muted-foreground">
              {account.stripeCustomerId
                ? "Could not fetch data from Stripe."
                : "This account has no linked Stripe Customer ID."}
            </p>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            <SubscriptionsBlock subscriptions={stripeDetail.subscriptions} />
            <PaymentsBlock payments={stripeDetail.payments} />
            <InvoicesBlock invoices={stripeDetail.invoices} />
            <ActivityBlock events={stripeDetail.recentActivity} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Stripe blocks ─── */

function SubscriptionsBlock({
  subscriptions,
}: {
  subscriptions: StripeCustomerDetail["subscriptions"];
}) {
  return (
    <Section title={`Subscriptions (${subscriptions.length})`}>
      {subscriptions.length === 0 ? (
        <EmptyRow>No subscriptions</EmptyRow>
      ) : (
        <div className="divide-y">
          {subscriptions.map((sub) => (
            <div key={sub.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <a
                  href={`https://dashboard.stripe.com/subscriptions/${sub.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 font-mono text-sm text-primary hover:underline"
                >
                  {sub.id}
                  <ExternalLink className="size-3" />
                </a>
                <Badge variant={statusVariant(sub.status)}>{sub.status}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {fmtDate(sub.currentPeriodStart)} → {fmtDate(sub.currentPeriodEnd)}
                {sub.cancelAtPeriodEnd && " (cancels at period end)"}
              </p>
              {sub.items.length > 0 && (
                <div className="overflow-x-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="text-xs">Product</TableHead>
                        <TableHead className="text-right text-xs">Qty</TableHead>
                        <TableHead className="text-right text-xs">Price</TableHead>
                        <TableHead className="text-right text-xs">Interval</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sub.items.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-xs">
                            {item.productName ?? item.priceId}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {item.quantity ?? 1}
                          </TableCell>
                          <TableCell className="text-right font-mono text-xs">
                            {fmtCents(item.amount, item.currency)}
                          </TableCell>
                          <TableCell className="text-right text-xs">
                            {item.interval ? `/${item.interval}` : "one-time"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function PaymentsBlock({
  payments,
}: {
  payments: StripeCustomerDetail["payments"];
}) {
  return (
    <Section title={`Payments (${payments.length})`}>
      {payments.length === 0 ? (
        <EmptyRow>No payments</EmptyRow>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-right text-xs">Amount</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs">Description</TableHead>
                <TableHead className="text-xs" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {payments.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="whitespace-nowrap text-xs">
                    {fmtDate(p.created)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {fmtCents(p.amount, p.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(p.status)} className="text-[10px]">
                      {p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-[180px] truncate text-xs text-muted-foreground">
                    {p.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <a
                      href={`https://dashboard.stripe.com/payments/${p.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

function InvoicesBlock({
  invoices,
}: {
  invoices: StripeCustomerDetail["invoices"];
}) {
  return (
    <Section title={`Invoices (${invoices.length})`}>
      {invoices.length === 0 ? (
        <EmptyRow>No invoices</EmptyRow>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Invoice</TableHead>
                <TableHead className="text-xs">Date</TableHead>
                <TableHead className="text-right text-xs">Due</TableHead>
                <TableHead className="text-right text-xs">Paid</TableHead>
                <TableHead className="text-xs">Status</TableHead>
                <TableHead className="text-xs" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="font-mono text-xs">
                    {inv.number ?? inv.id}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs">
                    {fmtDate(inv.created)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {fmtCents(inv.amountDue, inv.currency)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">
                    {fmtCents(inv.amountPaid, inv.currency)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={statusVariant(inv.status ?? "unknown")}
                      className="text-[10px]"
                    >
                      {inv.status ?? "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {inv.hostedInvoiceUrl ? (
                      <a
                        href={inv.hostedInvoiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    ) : (
                      <a
                        href={`https://dashboard.stripe.com/invoices/${inv.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </Section>
  );
}

function ActivityBlock({
  events,
}: {
  events: StripeCustomerDetail["recentActivity"];
}) {
  return (
    <Section title="Recent Activity">
      {events.length === 0 ? (
        <EmptyRow>No recent activity</EmptyRow>
      ) : (
        <div className="divide-y">
          {events.map((evt) => (
            <div
              key={evt.id}
              className="flex items-start gap-3 px-4 py-2.5"
            >
              <div className="mt-0.5 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
              <div className="flex flex-col gap-0.5">
                <p className="text-sm">{evt.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {fmtDateTime(evt.created)}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

/* ─── Shared components ─── */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border">
      <div className="border-b bg-muted/40 px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div>{children}</div>
    </div>
  );
}

function Field({
  label,
  value,
  children,
}: {
  label: string;
  value?: string | null;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 border-b px-4 py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-4">
      <dt className="min-w-[160px] shrink-0 text-sm font-medium text-muted-foreground">
        {label}
      </dt>
      <dd className="text-sm">
        {children ??
          (value ? value : <span className="text-muted-foreground">—</span>)}
      </dd>
    </div>
  );
}

function LinkButtons({
  sfUrl,
  stripeUrl,
}: {
  sfUrl: string;
  stripeUrl: string | null;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Button
        variant="outline"
        size="sm"
        className="h-7 gap-1 px-2"
        asChild
      >
        <a href={sfUrl} target="_blank" rel="noopener noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/images/salesforce-logo.svg" alt="Salesforce" className="h-5 w-auto" />
          <ExternalLink className="size-3" />
        </a>
      </Button>
      {stripeUrl ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2"
          asChild
        >
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
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
```

## `customers/[id]/tabs/audit-tab.tsx`

```tsx
// Re-export from shared location
export { AuditTab } from "@/components/customer/tabs/audit-tab";
```

## `customers/[id]/tabs/overview-tab.tsx`

```tsx
// Re-export from shared location
export { OverviewTab } from "@/components/customer/tabs/overview-tab";
```

## `customers/[id]/tabs/salesforce-tab.tsx`

```tsx
// Re-export from shared location
export { SalesforceTab } from "@/components/customer/tabs/salesforce-tab";
```

## `customers/[id]/tabs/stripe-tab.tsx`

```tsx
// Re-export from shared location
export { StripeTab } from "@/components/customer/tabs/stripe-tab";
```

## `customers/[id]/tabs/work-items-tab.tsx`

```tsx
// Re-export from shared location
export { WorkItemsTab } from "@/components/customer/tabs/work-items-tab";
```

## `customers/accounts-table.tsx`

```tsx
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
                const sfBase = process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://yourorg.lightning.force.com";
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
```

## `customers/loading.tsx`

```tsx
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="animate-pulse rounded bg-muted h-7 w-48" />
        <div className="animate-pulse rounded bg-muted h-4 w-72" />
      </div>
      <div className="animate-pulse rounded bg-muted h-10 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded bg-muted h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
```

## `customers/page.tsx`

```tsx
import Link from "next/link";
import { searchCustomersUnified, getMyAccounts, getAllAccountsAdmin } from "@/lib/queries/customers";
import { revalidateCustomers } from "@/lib/actions/revalidate";
import { RefreshButton } from "@/components/refresh-button";
import { SearchForm } from "./search-form";
import { AccountsTable } from "./accounts-table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

const SOURCE_LABELS = {
  local: { label: "Local DB", variant: "outline" as const },
  salesforce: { label: "Salesforce", variant: "default" as const },
  stripe: { label: "Stripe", variant: "secondary" as const },
};

async function getSessionRole(): Promise<string> {
  try {
    const { requireSession } = await import("@omnibridge/auth");
    const session = await requireSession();
    return (session.user as { role?: string }).role ?? "member";
  } catch {
    return "member";
  }
}

export default async function CustomersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const isSearching = query.length >= 2;

  const role = await getSessionRole();
  const isAdmin = role === "admin";

  const [myAccounts, allAccounts, searchResults] = await Promise.all([
    isSearching ? Promise.resolve([]) : getMyAccounts().catch(() => []),
    isSearching || !isAdmin ? Promise.resolve(null) : getAllAccountsAdmin().catch(() => null),
    isSearching ? searchCustomersUnified(query) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
          <p className="text-sm text-muted-foreground">
            Your accounts and cross-system customer search.
          </p>
        </div>
        <RefreshButton action={revalidateCustomers} />
      </div>

      <SearchForm defaultValue={query} />

      {isSearching ? (
        <SearchResults query={query} customers={searchResults} />
      ) : (
        <AccountsTable myAccounts={myAccounts} allAccounts={allAccounts} isAdmin={isAdmin} />
      )}
    </div>
  );
}

function SearchResults({
  query,
  customers,
}: {
  query: string;
  customers: Awaited<ReturnType<typeof searchCustomersUnified>>;
}) {
  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Search Results</CardTitle>
        <CardDescription>
          {customers.length} result{customers.length !== 1 ? "s" : ""} for
          &ldquo;{query}&rdquo;
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        {customers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[180px]">Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>Stripe ID</TableHead>
                <TableHead>Salesforce ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map((c) => {
                const src = SOURCE_LABELS[c.source];
                const detailHref =
                  c.source === "local" ? `/customers/${c.id}` : null;

                return (
                  <TableRow key={c.id}>
                    <TableCell>
                      {detailHref ? (
                        <Link
                          href={detailHref}
                          className="font-medium hover:underline"
                        >
                          {c.name}
                        </Link>
                      ) : (
                        <span className="font-medium">{c.name}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.email ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {c.domain ?? "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={src.variant}>{src.label}</Badge>
                    </TableCell>
                    <TableCell>
                      {c.stripeCustomerId ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.stripeCustomerId}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {c.sfAccountId ? (
                        <Badge variant="outline" className="font-mono text-xs">
                          {c.sfAccountId}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium">No customers found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different search term.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

## `customers/search-form.tsx`

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleChange(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value.trim()) {
          params.set("q", value.trim());
        } else {
          params.delete("q");
        }
        router.replace(`/customers?${params.toString()}`);
      });
    }, 300);
  }

  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      <Input
        ref={inputRef}
        type="search"
        placeholder="Search customers…"
        defaultValue={defaultValue}
        onChange={(e) => handleChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
```

## `layout.tsx`

```tsx
import { Sidebar } from "@/components/sidebar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1400px] px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
```

## `opportunities/all/page.tsx`

```tsx
import { getAllOpportunitiesAdmin, type OpportunityRow } from "@/lib/queries/opportunities";
import { OpportunitiesTable } from "../opportunities-table";

export default async function AllOpportunitiesPage() {
  let opportunities: OpportunityRow[] = [];
  let error: string | null = null;

  try {
    opportunities = await getAllOpportunitiesAdmin();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load opportunities.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          All open opportunities across the organization.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <OpportunitiesTable opportunities={opportunities} showOwner />
      )}
    </div>
  );
}
```

## `opportunities/create/page.tsx`

```tsx
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Create Opportunity</h1>
        </div>
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
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Opportunity</h1>
        <p className="text-sm text-muted-foreground">
          Create a new opportunity in Salesforce without going through CPQ.
        </p>
      </div>

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
```

## `opportunities/dashboard-charts.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type { OpportunityRow } from "@/lib/queries/opportunities";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#9333ea",
  "#f59e0b",
  "#64748b",
];

const STAGE_COLOR: Record<string, string> = {
  "Discovery & Qualification": "var(--chart-3)",
  "Customer Evaluation": "var(--chart-5)",
  "Pricing & Negotiation": "var(--chart-4)",
  "Contract Sent": "var(--chart-2)",
  "Closed Won": "var(--chart-1)",
  "Closed Lost": "#64748b",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatCompactCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return formatCurrency(amount);
}

function monthKey(dateStr: string): string {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1);
  return d.toLocaleDateString("en-US", { month: "short", year: "numeric" });
}

const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const cx = (props.cx as number) ?? 0;
  const cy = (props.cy as number) ?? 0;
  const midAngle = (props.midAngle as number) ?? 0;
  const outerRadius = (props.outerRadius as number) ?? 0;
  const name = (props.name as string) ?? "";
  const percent = (props.percent as number) ?? 0;

  const radius = outerRadius + 32;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="fill-foreground text-xs font-semibold"
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabelLine(props: any) {
  const cx = (props.cx as number) ?? 0;
  const cy = (props.cy as number) ?? 0;
  const midAngle = (props.midAngle as number) ?? 0;
  const outerRadius = (props.outerRadius as number) ?? 0;
  const stroke = (props.stroke as string) ?? "#999";

  const innerPt = {
    x: cx + (outerRadius + 4) * Math.cos(-midAngle * RADIAN),
    y: cy + (outerRadius + 4) * Math.sin(-midAngle * RADIAN),
  };
  const outerPt = {
    x: cx + (outerRadius + 26) * Math.cos(-midAngle * RADIAN),
    y: cy + (outerRadius + 26) * Math.sin(-midAngle * RADIAN),
  };
  return (
    <line
      x1={innerPt.x}
      y1={innerPt.y}
      x2={outerPt.x}
      y2={outerPt.y}
      stroke={stroke}
      strokeWidth={1.5}
    />
  );
}

const ALL = "__all__";

interface DashboardChartsProps {
  opportunities: OpportunityRow[];
}

export function DashboardCharts({ opportunities }: DashboardChartsProps) {
  const currentYear = new Date().getFullYear();
  const yearStart = `${currentYear}-01-01`;

  const ytdOpps = useMemo(
    () => opportunities.filter((o) => o.createdDate >= yearStart),
    [opportunities, yearStart],
  );

  const closedWonYtd = useMemo(
    () =>
      opportunities.filter(
        (o) => o.stageName === "Closed Won" && o.closeDate >= yearStart,
      ),
    [opportunities, yearStart],
  );

  const openOpps = useMemo(
    () =>
      opportunities.filter(
        (o) => o.stageName !== "Closed Won" && o.stageName !== "Closed Lost",
      ),
    [opportunities],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <StagesPieChart opps={ytdOpps} year={currentYear} />
        <div className="flex flex-col gap-6">
          <RevenueCard opps={closedWonYtd} year={currentYear} />
          <TopCustomers opps={closedWonYtd} year={currentYear} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ClosedWonByOperator opps={closedWonYtd} year={currentYear} />
        <ExpirationBoard opps={openOpps} />
      </div>
    </div>
  );
}

function StagesPieChart({ opps, year }: { opps: OpportunityRow[]; year: number }) {
  const data = useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of opps) {
      counts.set(o.stageName, (counts.get(o.stageName) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [opps]);

  const total = opps.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Opportunities by Stage</CardTitle>
        <CardDescription>
          {total} opportunities created in {year}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[520px] items-center justify-center text-sm text-muted-foreground">
            No opportunities yet this year.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={520}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                outerRadius={180}
                paddingAngle={1}
                dataKey="value"
                label={renderPieLabel}
                labelLine={renderPieLabelLine}
              >
                {data.map((entry, i) => (
                  <Cell
                    key={entry.name}
                    fill={STAGE_COLOR[entry.name] ?? CHART_COLORS[i % CHART_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, name) => {
                  const v = Number(value) || 0;
                  return [`${v} (${((v / total) * 100).toFixed(1)}%)`, String(name)];
                }}
              />
              <Legend
                formatter={(value: string) => (
                  <span className="text-xs font-semibold text-foreground">
                    {value}
                  </span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ClosedWonByOperator({
  opps,
  year,
}: {
  opps: OpportunityRow[];
  year: number;
}) {
  const data = useMemo(() => {
    const byOwner = new Map<string, { total: number; count: number }>();
    for (const o of opps) {
      const owner = o.ownerName ?? "Unknown";
      const prev = byOwner.get(owner) ?? { total: 0, count: 0 };
      byOwner.set(owner, {
        total: prev.total + (o.amount ?? 0),
        count: prev.count + 1,
      });
    }
    return Array.from(byOwner.entries())
      .map(([name, { total, count }]) => ({ name, total, count }))
      .sort((a, b) => b.total - a.total);
  }, [opps]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Closed Won by Operator</CardTitle>
        <CardDescription>
          Revenue leaderboard &mdash; {year} YTD
        </CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[280px] items-center justify-center text-sm text-muted-foreground">
            No closed-won deals yet this year.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={Math.max(280, data.length * 50)}>
            <BarChart data={data} layout="vertical" margin={{ left: 20, right: 20 }}>
              <XAxis
                type="number"
                tickFormatter={(v) => formatCompactCurrency(v)}
                fontSize={12}
              />
              <YAxis
                type="category"
                dataKey="name"
                width={120}
                fontSize={12}
                tickLine={false}
              />
              <Tooltip
                formatter={(value) => [formatCurrency(Number(value) || 0), "Revenue"]}
                labelFormatter={(label) => String(label)}
              />
              <Bar
                dataKey="total"
                fill="var(--chart-1)"
                radius={[0, 4, 4, 0]}
                label={{
                  position: "right",
                  formatter: (v) => formatCompactCurrency(Number(v) || 0),
                  fontSize: 12,
                }}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

function ExpirationBoard({ opps }: { opps: OpportunityRow[] }) {
  const [ownerFilter, setOwnerFilter] = useState(ALL);

  const owners = useMemo(() => {
    const set = new Set<string>();
    for (const o of opps) {
      if (o.ownerName) set.add(o.ownerName);
    }
    return Array.from(set).sort();
  }, [opps]);

  const filtered = useMemo(
    () =>
      ownerFilter === ALL
        ? opps
        : opps.filter((o) => o.ownerName === ownerFilter),
    [opps, ownerFilter],
  );

  const grouped = useMemo(() => {
    const map = new Map<string, OpportunityRow[]>();
    for (const o of filtered) {
      const key = monthKey(o.closeDate);
      const arr = map.get(key) ?? [];
      arr.push(o);
      map.set(key, arr);
    }
    return Array.from(map.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, items]) => ({
        key,
        label: monthLabel(key),
        items: items.sort((a, b) => a.closeDate.localeCompare(b.closeDate)),
      }));
  }, [filtered]);

  const isPast = (dateStr: string) => new Date(dateStr) < new Date();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Opportunity Expiration Calendar</CardTitle>
            <CardDescription>
              Open opportunities grouped by close date month
            </CardDescription>
          </div>
          <Select value={ownerFilter} onValueChange={setOwnerFilter}>
            <SelectTrigger size="sm" className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Operators</SelectItem>
              {owners.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {grouped.length === 0 ? (
          <div className="flex h-[200px] items-center justify-center text-sm text-muted-foreground">
            No open opportunities to display.
          </div>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2">
            {grouped.map((col) => (
              <div
                key={col.key}
                className="flex w-[260px] flex-shrink-0 flex-col gap-2"
              >
                <div className="flex items-center justify-between rounded-md bg-muted px-3 py-2">
                  <span className="text-sm font-semibold">{col.label}</span>
                  <Badge variant="secondary">{col.items.length}</Badge>
                </div>
                <div className="flex flex-col gap-2">
                  {col.items.map((opp) => (
                    <div
                      key={opp.id}
                      className={`rounded-md border p-3 text-sm ${
                        isPast(opp.closeDate)
                          ? "border-destructive/40 bg-destructive/5"
                          : "bg-card"
                      }`}
                    >
                      <p
                        className="font-medium leading-tight"
                        title={opp.name}
                      >
                        {opp.name.length > 35
                          ? opp.name.slice(0, 35) + "..."
                          : opp.name}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {opp.accountName ?? "No account"}
                      </p>
                      <div className="mt-2 flex items-center justify-between">
                        <Badge variant="outline" className="text-[10px]">
                          {opp.stageName}
                        </Badge>
                        <span className="font-mono text-xs">
                          {opp.amount !== null
                            ? formatCompactCurrency(opp.amount)
                            : "-"}
                        </span>
                      </div>
                      {opp.ownerName && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {opp.ownerName}
                        </p>
                      )}
                      {isPast(opp.closeDate) && (
                        <p className="mt-1 text-[10px] font-medium text-destructive">
                          Overdue &mdash;{" "}
                          {new Date(opp.closeDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TopCustomers({
  opps,
  year,
}: {
  opps: OpportunityRow[];
  year: number;
}) {
  const data = useMemo(() => {
    const byAccount = new Map<string, { name: string; total: number; count: number }>();
    for (const o of opps) {
      const key = o.accountId ?? o.accountName ?? o.name;
      const name = o.accountName ?? "Unknown";
      const prev = byAccount.get(key) ?? { name, total: 0, count: 0 };
      byAccount.set(key, {
        name,
        total: prev.total + (o.amount ?? 0),
        count: prev.count + 1,
      });
    }
    return Array.from(byAccount.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 20);
  }, [opps]);

  return (
    <Card className="flex-1">
      <CardHeader>
        <CardTitle>Top 20 Customers &mdash; Closed Won</CardTitle>
        <CardDescription>By revenue in {year} YTD</CardDescription>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-[120px] items-center justify-center text-sm text-muted-foreground">
            No closed-won deals yet.
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8 text-center">#</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">Deals</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((row, i) => (
                  <TableRow key={row.name}>
                    <TableCell className="text-center text-muted-foreground">
                      {i + 1}
                    </TableCell>
                    <TableCell className="font-medium">{row.name}</TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.total)}
                    </TableCell>
                    <TableCell className="text-right">{row.count}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RevenueCard({
  opps,
  year,
}: {
  opps: OpportunityRow[];
  year: number;
}) {
  const { totalRevenue, dealCount, avgDealSize } = useMemo(() => {
    let total = 0;
    let count = 0;
    for (const o of opps) {
      total += o.amount ?? 0;
      count++;
    }
    return {
      totalRevenue: total,
      dealCount: count,
      avgDealSize: count > 0 ? total / count : 0,
    };
  }, [opps]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Total Revenue YTD</CardTitle>
        <CardDescription>Closed-won revenue in {year}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <div>
          <p className="text-4xl font-bold tracking-tight">
            {formatCurrency(totalRevenue)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            from {dealCount} closed{dealCount === 1 ? " deal" : " deals"}
          </p>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Avg Deal Size
            </p>
            <p className="mt-1 text-lg font-semibold">
              {formatCurrency(avgDealSize)}
            </p>
          </div>
          <div className="rounded-md bg-muted/50 p-3">
            <p className="text-xs font-medium text-muted-foreground">
              Deals Closed
            </p>
            <p className="mt-1 text-lg font-semibold">{dealCount}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

## `opportunities/loading.tsx`

```tsx
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="animate-pulse rounded bg-muted h-7 w-64" />
        <div className="animate-pulse rounded bg-muted h-4 w-80" />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="animate-pulse rounded bg-muted h-[520px]" />
        <div className="flex flex-col gap-6">
          <div className="animate-pulse rounded bg-muted h-64" />
          <div className="animate-pulse rounded bg-muted h-64" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="animate-pulse rounded bg-muted h-64" />
        <div className="animate-pulse rounded bg-muted h-64" />
      </div>
    </div>
  );
}
```

## `opportunities/my/page.tsx`

```tsx
import { getMyOpportunities, type OpportunityRow } from "@/lib/queries/opportunities";
import { OpportunitiesTable } from "../opportunities-table";

export default async function MyOpportunitiesPage() {
  let opportunities: OpportunityRow[] = [];
  let error: string | null = null;

  try {
    opportunities = await getMyOpportunities();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load opportunities.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Opportunities</h1>
        <p className="text-sm text-muted-foreground">
          Open opportunities assigned to you in Salesforce.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <OpportunitiesTable opportunities={opportunities} />
      )}
    </div>
  );
}
```

## `opportunities/opportunities-table.tsx`

```tsx
"use client";

import { useMemo, useState } from "react";
import type { OpportunityRow } from "@/lib/queries/opportunities";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDollars } from "@/lib/format";

function stageBadgeVariant(
  stage: string,
): "default" | "secondary" | "destructive" | "outline" {
  switch (stage) {
    case "Closed Won":
      return "default";
    case "Closed Lost":
      return "destructive";
    case "Contract Sent":
    case "Pricing & Negotiation":
      return "secondary";
    default:
      return "outline";
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const ALL = "__all__";

interface OpportunitiesTableProps {
  opportunities: OpportunityRow[];
  showOwner?: boolean;
}

export function OpportunitiesTable({
  opportunities,
  showOwner = false,
}: OpportunitiesTableProps) {
  const [ownerFilter, setOwnerFilter] = useState(ALL);
  const [stageFilter, setStageFilter] = useState(ALL);
  const [closeDateFrom, setCloseDateFrom] = useState("");
  const [closeDateTo, setCloseDateTo] = useState("");

  const uniqueOwners = useMemo(() => {
    const set = new Set<string>();
    for (const opp of opportunities) {
      if (opp.ownerName) set.add(opp.ownerName);
    }
    return Array.from(set).sort();
  }, [opportunities]);

  const uniqueStages = useMemo(() => {
    const set = new Set<string>();
    for (const opp of opportunities) {
      if (opp.stageName) set.add(opp.stageName);
    }
    return Array.from(set).sort();
  }, [opportunities]);

  const filtered = useMemo(() => {
    return opportunities.filter((opp) => {
      if (ownerFilter !== ALL && opp.ownerName !== ownerFilter) return false;
      if (stageFilter !== ALL && opp.stageName !== stageFilter) return false;
      if (closeDateFrom && opp.closeDate < closeDateFrom) return false;
      if (closeDateTo && opp.closeDate > closeDateTo) return false;
      return true;
    });
  }, [opportunities, ownerFilter, stageFilter, closeDateFrom, closeDateTo]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-3">
        {showOwner && (
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-muted-foreground">
              Owner
            </label>
            <Select value={ownerFilter} onValueChange={setOwnerFilter}>
              <SelectTrigger size="sm" className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All Owners</SelectItem>
                {uniqueOwners.map((owner) => (
                  <SelectItem key={owner} value={owner}>
                    {owner}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Stage
          </label>
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger size="sm" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Stages</SelectItem>
              {uniqueStages.map((stage) => (
                <SelectItem key={stage} value={stage}>
                  {stage}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Close Date From
          </label>
          <Input
            type="date"
            value={closeDateFrom}
            onChange={(e) => setCloseDateFrom(e.target.value)}
            className="h-8 w-[150px] text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-muted-foreground">
            Close Date To
          </label>
          <Input
            type="date"
            value={closeDateTo}
            onChange={(e) => setCloseDateTo(e.target.value)}
            className="h-8 w-[150px] text-sm"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-md border px-4 py-12 text-center text-sm text-muted-foreground">
          No opportunities match the current filters.
        </div>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Opportunity</TableHead>
                <TableHead>Account</TableHead>
                {showOwner && <TableHead>Owner</TableHead>}
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Created Date</TableHead>
                <TableHead>Close Date</TableHead>
                <TableHead>Last Modified</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((opp) => (
                <TableRow key={opp.id}>
                  <TableCell className="font-medium">{opp.name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {opp.accountName ?? "-"}
                  </TableCell>
                  {showOwner && (
                    <TableCell className="text-muted-foreground">
                      {opp.ownerName ?? "-"}
                    </TableCell>
                  )}
                  <TableCell>
                    <Badge variant={stageBadgeVariant(opp.stageName)}>
                      {opp.stageName}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatDollars(opp.amount)}
                  </TableCell>
                  <TableCell>{formatDate(opp.createdDate)}</TableCell>
                  <TableCell>{formatDate(opp.closeDate)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(opp.lastModified)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Showing {filtered.length} of {opportunities.length} opportunities
      </p>
    </div>
  );
}
```

## `opportunities/page.tsx`

```tsx
import { getDashboardOpportunities } from "@/lib/queries/opportunities";
import { DashboardCharts } from "./dashboard-charts";

export default async function OpportunitiesPage() {
  let error: string | null = null;
  let opportunities: Awaited<ReturnType<typeof getDashboardOpportunities>> = [];

  try {
    opportunities = await getDashboardOpportunities();
  } catch (err) {
    error =
      err instanceof Error ? err.message : "Failed to load dashboard data.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Opportunities Dashboard
        </h1>
        <p className="text-sm text-muted-foreground">
          Year-to-date pipeline overview and revenue insights.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <DashboardCharts opportunities={opportunities} />
      )}
    </div>
  );
}
```

## `products/page.tsx`

```tsx
import { fetchStripeProducts } from "@/lib/queries/stripe-products";
import { fetchSfdcProducts } from "@/lib/queries/sfdc-products";
import { getProductLogs } from "@/lib/queries/product-logs";
import { detectSfdcProductChanges } from "@/lib/sfdc-product-poller";
import { revalidateProducts } from "@/lib/actions/revalidate";
import { RefreshButton } from "@/components/refresh-button";
import { ProductCatalogTabs } from "./product-tabs";

async function getSessionRole(): Promise<string> {
  try {
    const { requireSession } = await import("@omnibridge/auth");
    const session = await requireSession();
    return (session.user as { role?: string }).role ?? "member";
  } catch {
    return "member";
  }
}

export default async function ProductCatalogPage() {
  const [stripeProducts, sfdcProducts, role] = await Promise.all([
    fetchStripeProducts(),
    fetchSfdcProducts(),
    getSessionRole(),
  ]);

  // Run SFDC change detection in the background (non-blocking)
  detectSfdcProductChanges(sfdcProducts).catch(() => {});

  const [stripeLogs, sfdcLogs] = await Promise.all([
    getProductLogs(["stripe", "omnibridge"]),
    getProductLogs("salesforce"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Product Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Manage products across Salesforce and Stripe.
          </p>
        </div>
        <RefreshButton action={revalidateProducts} />
      </div>

      <ProductCatalogTabs
        stripeProducts={stripeProducts}
        sfdcProducts={sfdcProducts}
        isAdmin={role === "admin"}
        stripeLogs={stripeLogs}
        sfdcLogs={sfdcLogs}
      />
    </div>
  );
}
```

## `products/product-tabs.tsx`

```tsx
"use client";

import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState, useMemo, useCallback, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Loader2, Power } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { StripeProduct, StripeProductPrice } from "@/lib/queries/stripe-products";
import { fetchPricesForProduct } from "@/lib/queries/stripe-products";
import { deactivateStripeProducts } from "@/lib/actions/stripe-products";
import type { SfdcProduct } from "@/lib/queries/sfdc-products";
import type { ProductLogEntry } from "@/lib/queries/product-logs";

type StatusFilter = "all" | "active" | "inactive";

function formatStripeCurrency(amount: number | null, currency: string): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
  }).format(amount / 100);
}

function formatSfdcCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(amount);
}

function formatInterval(interval: string | null, type: "recurring" | "one_time"): string {
  if (type === "one_time") return "one-time";
  return interval ? `/ ${interval}` : "";
}

interface Props {
  stripeProducts: StripeProduct[];
  sfdcProducts: SfdcProduct[];
  isAdmin?: boolean;
  stripeLogs?: ProductLogEntry[];
  sfdcLogs?: ProductLogEntry[];
}

export function ProductCatalogTabs({ stripeProducts, sfdcProducts, isAdmin = false, stripeLogs = [], sfdcLogs = [] }: Props) {
  const router = useRouter();
  const [sfdcFilter, setSfdcFilter] = useState("");
  const [stripeFilter, setStripeFilter] = useState("");
  const [sfdcStatus, setSfdcStatus] = useState<StatusFilter>("active");
  const [stripeStatus, setStripeStatus] = useState<StatusFilter>("active");
  const [sfdcFamily, setSfdcFamily] = useState<string>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [deactivatedIds, setDeactivatedIds] = useState<Set<string>>(new Set());
  const [deactivating, startDeactivate] = useTransition();

  const stripeById = useMemo(() => {
    const map = new Map<string, StripeProduct>();
    for (const p of stripeProducts) {
      map.set(p.id, p);
    }
    return map;
  }, [stripeProducts]);

  const sfdcFamilies = useMemo(() => {
    const set = new Set<string>();
    for (const p of sfdcProducts) {
      if (p.family) set.add(p.family);
    }
    return Array.from(set).sort();
  }, [sfdcProducts]);

  const filteredSfdc = useMemo(() => {
    return sfdcProducts.filter((p) => {
      if (sfdcStatus === "active" && !p.active) return false;
      if (sfdcStatus === "inactive" && p.active) return false;
      if (sfdcFamily !== "all" && p.family !== sfdcFamily) return false;
      if (!sfdcFilter) return true;
      const q = sfdcFilter.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.productCode?.toLowerCase().includes(q) ||
        p.family?.toLowerCase().includes(q) ||
        p.stripeProductId?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q)
      );
    });
  }, [sfdcProducts, sfdcFilter, sfdcStatus, sfdcFamily]);

  const liveStripeProducts = useMemo(
    () => stripeProducts.filter((p) => !deactivatedIds.has(p.id)),
    [stripeProducts, deactivatedIds],
  );

  const filteredStripe = useMemo(() => {
    return liveStripeProducts.filter((p) => {
      if (stripeStatus === "active" && !p.active) return false;
      if (stripeStatus === "inactive" && p.active) return false;
      if (!stripeFilter) return true;
      const q = stripeFilter.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q)
      );
    });
  }, [liveStripeProducts, stripeFilter, stripeStatus]);

  const sfdcActiveCount = filteredSfdc.filter((p) => p.active).length;
  const sfdcInactiveCount = filteredSfdc.filter((p) => !p.active).length;
  const stripeActiveCount = filteredStripe.filter((p) => p.active).length;
  const stripeInactiveCount = filteredStripe.filter((p) => !p.active).length;

  const toggleSelect = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const activeIds = filteredStripe.filter((p) => p.active).map((p) => p.id);
    setSelected((prev) =>
      prev.size === activeIds.length && activeIds.every((id) => prev.has(id))
        ? new Set()
        : new Set(activeIds),
    );
  }, [filteredStripe]);

  const handleDeactivate = useCallback(() => {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    startDeactivate(async () => {
      const result = await deactivateStripeProducts(ids);
      setSelected(new Set());
      if (result.success.length > 0) {
        setDeactivatedIds((prev) => {
          const next = new Set(prev);
          for (const id of result.success) next.add(id);
          return next;
        });
      }
      if (result.failed.length > 0) {
        console.error("Failed to deactivate:", result.failed);
      }
      router.refresh();
    });
  }, [selected, router]);

  return (
    <Tabs defaultValue="salesforce">
      <TabsList>
        <TabsTrigger value="salesforce">
          Salesforce
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {sfdcProducts.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="stripe">
          Stripe
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {liveStripeProducts.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="stripe-log">
          Stripe Log
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {stripeLogs.length}
          </Badge>
        </TabsTrigger>
        <TabsTrigger value="sfdc-log">
          Salesforce Log
          <Badge variant="secondary" className="ml-1.5 text-xs">
            {sfdcLogs.length}
          </Badge>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="salesforce" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Filter by name, code, family, or Stripe ID…"
            value={sfdcFilter}
            onChange={(e) => setSfdcFilter(e.target.value)}
            className="max-w-sm"
          />
          <StatusDropdown value={sfdcStatus} onChange={setSfdcStatus} />
          <FamilyDropdown
            value={sfdcFamily}
            onChange={setSfdcFamily}
            families={sfdcFamilies}
          />
          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{filteredSfdc.length}</span>{" "}
              shown
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground">{sfdcActiveCount}</span> active
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground">{sfdcInactiveCount}</span> inactive
            </span>
          </div>
        </div>

        {filteredSfdc.length === 0 ? (
          <EmptyState message="No Salesforce products match your filters." />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[200px]">Product</TableHead>
                  <TableHead className="min-w-[100px]">Code</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="min-w-[160px]">Stripe Product</TableHead>
                  <TableHead className="min-w-[140px]">Pricebook Entries</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredSfdc.map((p) => (
                  <SfdcRow key={p.id} product={p} stripeMap={stripeById} />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="stripe" className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Input
            placeholder="Filter by name or ID…"
            value={stripeFilter}
            onChange={(e) => setStripeFilter(e.target.value)}
            className="max-w-sm"
          />
          <StatusDropdown value={stripeStatus} onChange={setStripeStatus} />
          {isAdmin && selected.size > 0 && (
            <Button
              variant="destructive"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              disabled={deactivating}
              onClick={handleDeactivate}
            >
              {deactivating ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Power className="size-3.5" />
              )}
              Deactivate {selected.size} product{selected.size > 1 ? "s" : ""}
            </Button>
          )}
          <div className="ml-auto flex items-center gap-4 text-sm text-muted-foreground">
            <span>
              <span className="font-medium text-foreground">{filteredStripe.length}</span>{" "}
              shown
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground">{stripeActiveCount}</span> active
            </span>
            <span className="text-border">|</span>
            <span>
              <span className="font-medium text-foreground">{stripeInactiveCount}</span> inactive
            </span>
          </div>
        </div>

        {filteredStripe.length === 0 ? (
          <EmptyState message="No Stripe products match your filters." />
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  {isAdmin && (
                    <TableHead className="w-10 px-2">
                      <Checkbox
                        checked={
                          filteredStripe.filter((p) => p.active).length > 0 &&
                          filteredStripe.filter((p) => p.active).every((p) => selected.has(p.id))
                        }
                        onCheckedChange={toggleSelectAll}
                        aria-label="Select all"
                      />
                    </TableHead>
                  )}
                  <TableHead className="w-8"></TableHead>
                  <TableHead className="min-w-[200px]">Product</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead>Salesforce Product</TableHead>
                  <TableHead>Product ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStripe.map((p) => (
                  <StripeRow
                    key={p.id}
                    product={p}
                    isAdmin={isAdmin}
                    isSelected={selected.has(p.id)}
                    onToggleSelect={toggleSelect}
                  />
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </TabsContent>

      <TabsContent value="stripe-log" className="flex flex-col gap-4">
        <ActivityLogTab logs={stripeLogs} />
      </TabsContent>

      <TabsContent value="sfdc-log" className="flex flex-col gap-4">
        <ActivityLogTab logs={sfdcLogs} />
      </TabsContent>
    </Tabs>
  );
}

function ActivityLogTab({ logs }: { logs: ProductLogEntry[] }) {
  const [actionFilter, setActionFilter] = useState<string>("all");

  const actions = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) set.add(l.action);
    return Array.from(set).sort();
  }, [logs]);

  const filtered = useMemo(() => {
    if (actionFilter === "all") return logs;
    return logs.filter((l) => l.action === actionFilter);
  }, [logs, actionFilter]);

  return (
    <>
      <div className="flex items-center gap-3">
        <Select value={actionFilter} onValueChange={setActionFilter}>
          <SelectTrigger className="w-[170px]">
            <span className="text-muted-foreground mr-1">Action:</span>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {actions.map((a) => (
              <SelectItem key={a} value={a}>
                {a.charAt(0).toUpperCase() + a.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="ml-auto text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{filtered.length}</span>{" "}
          {filtered.length === 1 ? "entry" : "entries"}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No activity log entries match your filters." />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-[150px]">Timestamp</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="min-w-[200px]">Product</TableHead>
                <TableHead>Product ID</TableHead>
                <TableHead>Actor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((log) => (
                <LogRow key={log.id} log={log} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}

const ACTION_VARIANTS: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  created: "default",
  activated: "default",
  deactivated: "destructive",
  deleted: "destructive",
  updated: "secondary",
};

function LogRow({ log }: { log: ProductLogEntry }) {
  const ts = new Date(log.createdAt);
  const formatted = ts.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  const actor = log.actorLabel;

  return (
    <TableRow>
      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
        {formatted}
      </TableCell>
      <TableCell>
        <Badge variant={ACTION_VARIANTS[log.action] ?? "secondary"} className="text-xs capitalize">
          {log.action}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-sm font-medium">{log.productName ?? "—"}</span>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">
          {log.productId}
        </Badge>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {actor}
      </TableCell>
    </TableRow>
  );
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: StatusFilter;
  onChange: (v: StatusFilter) => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as StatusFilter)}>
      <SelectTrigger className="w-[150px]">
        <span className="text-muted-foreground mr-1">Status:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        <SelectItem value="active">Active</SelectItem>
        <SelectItem value="inactive">Inactive</SelectItem>
      </SelectContent>
    </Select>
  );
}

function FamilyDropdown({
  value,
  onChange,
  families,
}: {
  value: string;
  onChange: (v: string) => void;
  families: string[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[200px]">
        <span className="text-muted-foreground mr-1">Family:</span>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">All</SelectItem>
        {families.map((f) => (
          <SelectItem key={f} value={f}>
            {f}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SfdcRow({
  product,
  stripeMap,
}: {
  product: SfdcProduct;
  stripeMap: Map<string, StripeProduct>;
}) {
  const stripeProduct = product.stripeProductId
    ? stripeMap.get(product.stripeProductId)
    : null;

  return (
    <TableRow className={product.active ? "" : "opacity-60"}>
      <TableCell>
        <div className="flex flex-col gap-0.5 max-w-[300px]">
          <span className="font-medium truncate">{product.name}</span>
          {product.description && (
            <span className="text-xs text-muted-foreground" title={product.description}>
              {product.description.length > product.name.length
                ? product.description.slice(0, product.name.length) + "…"
                : product.description}
            </span>
          )}
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="font-mono text-xs">
          {product.productCode ?? "—"}
        </Badge>
      </TableCell>
      <TableCell>
        {product.family ? (
          <Badge variant="secondary">{product.family}</Badge>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant={product.active ? "default" : "secondary"}>
          {product.active ? "Active" : "Inactive"}
        </Badge>
      </TableCell>
      <TableCell>
        {product.stripeProductId ? (
          <div className="flex flex-col gap-0.5">
            <Badge variant="outline" className="font-mono text-xs w-fit">
              {product.stripeProductId}
            </Badge>
            {stripeProduct && (
              <span className="text-xs text-muted-foreground">
                {stripeProduct.name}
              </span>
            )}
            {product.stripeProductId && !stripeProduct && (
              <span className="text-xs text-destructive">
                Not found in Stripe
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">Not linked</span>
        )}
      </TableCell>
      <TableCell>
        <PricebookDropdown entries={product.pricebookEntries} />
      </TableCell>
    </TableRow>
  );
}

const SF_PRODUCT_META_KEYS = [
  "salesforce_product_id",
  "sf_product_id",
  "sfdc_product_id",
  "Salesforce_Product_ID",
  "SalesforceProductId",
];

function getSfProductId(metadata: Record<string, string>): string | null {
  for (const key of SF_PRODUCT_META_KEYS) {
    if (metadata[key]) return metadata[key];
  }
  for (const [key, value] of Object.entries(metadata)) {
    if (key.toLowerCase().includes("salesforce") && key.toLowerCase().includes("product")) {
      return value;
    }
  }
  return null;
}

function formatTimestamp(ts: number): string {
  return new Date(ts * 1000).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function StripeRow({
  product,
  isAdmin,
  isSelected,
  onToggleSelect,
}: {
  product: StripeProduct;
  isAdmin: boolean;
  isSelected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const sfProductId = getSfProductId(product.metadata);
  const [expanded, setExpanded] = useState(false);
  const [prices, setPrices] = useState<StripeProductPrice[] | null>(null);
  const [loading, setLoading] = useState(false);

  const toggle = useCallback(async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (prices) return;
    setLoading(true);
    try {
      const result = await fetchPricesForProduct(product.id);
      setPrices(result);
    } finally {
      setLoading(false);
    }
  }, [expanded, prices, product.id]);

  return (
    <>
      <TableRow className={product.active ? "" : "opacity-60"}>
        {isAdmin && (
          <TableCell className="w-10 px-2">
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(product.id)}
              disabled={!product.active}
              aria-label={`Select ${product.name}`}
            />
          </TableCell>
        )}
        <TableCell className="w-8 px-2 cursor-pointer" onClick={toggle}>
          <ChevronRight
            className={`size-4 text-muted-foreground transition-transform ${expanded ? "rotate-90" : ""}`}
          />
        </TableCell>
        <TableCell>
          <div className="flex flex-col gap-0.5">
            <a
              href={`https://dashboard.stripe.com/products/${product.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-primary hover:underline"
            >
              {product.name}
            </a>
            {product.description && (
              <span className="text-xs text-muted-foreground" title={product.description}>
                {product.description.length > product.name.length
                  ? product.description.slice(0, product.name.length) + "…"
                  : product.description}
              </span>
            )}
          </div>
        </TableCell>
        <TableCell>
          <Badge variant={product.active ? "default" : "secondary"}>
            {product.active ? "Active" : "Inactive"}
          </Badge>
        </TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
          {formatTimestamp(product.created)}
        </TableCell>
        <TableCell className="whitespace-nowrap text-muted-foreground text-xs">
          {formatTimestamp(product.updated)}
        </TableCell>
        <TableCell>
          {sfProductId ? (
            <Badge variant="outline" className="font-mono text-xs">
              {sfProductId}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell>
          <Badge variant="outline" className="font-mono text-xs">
            {product.id}
          </Badge>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow className="bg-muted/30 hover:bg-muted/30">
          {isAdmin && <TableCell />}
          <TableCell />
          <TableCell colSpan={6} className="py-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin" />
                Loading prices…
              </div>
            ) : prices && prices.length > 0 ? (
              <div className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground mb-1">
                  {prices.length} price{prices.length > 1 ? "s" : ""}
                </span>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-muted-foreground">
                      <th className="text-left font-medium pr-4 pb-1">Price ID</th>
                      <th className="text-left font-medium pr-4 pb-1">Name</th>
                      <th className="text-right font-medium pr-4 pb-1">Amount</th>
                      <th className="text-left font-medium pr-4 pb-1">Interval</th>
                      <th className="text-left font-medium pb-1">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((p) => (
                      <tr key={p.id}>
                        <td className="font-mono pr-4 py-0.5">{p.id}</td>
                        <td className="pr-4 py-0.5">{p.nickname ?? "—"}</td>
                        <td className="text-right font-mono pr-4 py-0.5">
                          {formatStripeCurrency(p.unitAmount, p.currency)}
                        </td>
                        <td className="pr-4 py-0.5">{formatInterval(p.interval, p.type)}</td>
                        <td className="py-0.5">
                          <Badge variant={p.active ? "default" : "secondary"} className="text-[10px] px-1.5 py-0">
                            {p.active ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <span className="text-sm text-muted-foreground">No prices found.</span>
            )}
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

function PricebookDropdown({ entries }: { entries: SfdcProduct["pricebookEntries"] }) {
  if (entries.length === 0) {
    return <span className="text-muted-foreground">No entries</span>;
  }

  if (entries.length === 1) {
    const e = entries[0];
    return (
      <span className="text-sm">
        <span className="font-mono text-xs">{formatSfdcCurrency(e.unitPrice)}</span>{" "}
        <span className="text-muted-foreground text-xs">{e.pricebookName}</span>
      </span>
    );
  }

  return (
    <Select defaultValue={entries[0].id}>
      <SelectTrigger className="h-7 w-[220px] text-xs">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {entries.map((e) => (
          <SelectItem key={e.id} value={e.id} className="text-xs">
            {formatSfdcCurrency(e.unitPrice)} — {e.pricebookName}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
      <p className="text-sm font-medium">{message}</p>
      <p className="text-sm text-muted-foreground">Try adjusting your filters.</p>
    </div>
  );
}
```

## `quotes/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import { getQuoteDetail, getQuoteAuditTimeline } from "@/lib/queries/quotes";
import { QuoteDetailView } from "./quote-detail";

export default async function QuoteDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const [quote, timeline] = await Promise.all([
    getQuoteDetail(id),
    getQuoteAuditTimeline(id),
  ]);

  if (!quote) notFound();

  return (
    <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6">
      <QuoteDetailView quote={quote} timeline={timeline} />
    </div>
  );
}
```

## `quotes/[id]/quote-detail.tsx`

```tsx
"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { formatCurrency, formatDateTime, formatDate, quoteStatusVariant } from "@/lib/format";
import type { QuoteDetail, AuditTimelineEntry } from "@/lib/queries/quotes";

interface Props {
  quote: QuoteDetail;
  timeline: AuditTimelineEntry[];
}

const STRIPE_DASHBOARD = "https://dashboard.stripe.com";
const SF_BASE = process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://yourorg.lightning.force.com";

const ACTION_COLORS: Record<string, string> = {
  "quote.created": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "quote.dry_run": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "quote.finalized": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  "quote.docusign_created": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "quote.docusign_sent": "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  "quote.accepted_via_checkout": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "quote.invoice_paid": "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  "subscription.schedule_created": "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  "quote.canceled": "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export function QuoteDetailView({ quote, timeline }: Props) {
  return (
    <>
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/quotes">
            <ArrowLeft className="mr-1 size-4" />
            Back
          </Link>
        </Button>
        <div className="flex flex-col">
          <h1 className="text-xl font-bold tracking-tight">
            Quote — {quote.customerName}
          </h1>
          <span className="text-sm text-muted-foreground">
            {quote.stripeQuoteNumber ?? quote.stripeQuoteId}
          </span>
        </div>
        <Badge variant={quoteStatusVariant(quote.status)} className="ml-auto">
          {quote.status}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <CrossSystemPanel quote={quote} />
        <ValidationPanel quote={quote} />
      </div>

      <LineItemsPanel lineItemsJson={quote.lineItemsJson} currency={quote.currency} />

      <LifecycleTimeline timeline={timeline} />
    </>
  );
}

function CrossSystemPanel({ quote }: { quote: QuoteDetail }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Cross-System IDs
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <IdRow
          label="Stripe Quote"
          value={quote.stripeQuoteId}
          subValue={quote.stripeQuoteNumber}
          href={`${STRIPE_DASHBOARD}/quotes/${quote.stripeQuoteId}`}
          linkLabel="Open in Stripe"
        />
        <IdRow
          label="Salesforce Quote"
          value={quote.sfQuoteId}
          subValue={quote.sfQuoteNumber}
          href={quote.sfQuoteId ? `${SF_BASE}/lightning/r/Stripe_Quote__c/${quote.sfQuoteId}/view` : undefined}
          linkLabel="Open in Salesforce"
        />
        <IdRow
          label="DocuSign"
          value={quote.docusignEnvelopeId}
          href={
            quote.docusignEnvelopeId
              ? `https://app.docusign.com/documents/details/${quote.docusignEnvelopeId}`
              : undefined
          }
          linkLabel="Open in DocuSign"
        />

        <Separator />

        <IdRow
          label="Stripe Customer"
          value={quote.stripeCustomerId}
          href={`${STRIPE_DASHBOARD}/customers/${quote.stripeCustomerId}`}
          linkLabel="Open in Stripe"
        />
        <IdRow
          label="Salesforce Account"
          value={quote.sfAccountId}
          href={
            quote.sfAccountId ? `${SF_BASE}/lightning/r/Account/${quote.sfAccountId}/view` : undefined
          }
          linkLabel="Open in Salesforce"
        />
        <IdRow
          label="Opportunity"
          value={quote.opportunityId}
          href={
            quote.opportunityId
              ? `${SF_BASE}/lightning/r/Opportunity/${quote.opportunityId}/view`
              : undefined
          }
          linkLabel="Open in Salesforce"
        />

        {(quote.stripeSubscriptionId || quote.stripeScheduleId) && (
          <>
            <Separator />
            <IdRow
              label="Stripe Subscription"
              value={quote.stripeSubscriptionId}
              href={
                quote.stripeSubscriptionId
                  ? `${STRIPE_DASHBOARD}/subscriptions/${quote.stripeSubscriptionId}`
                  : undefined
              }
              linkLabel="Open in Stripe"
            />
            <IdRow
              label="Stripe Schedule"
              value={quote.stripeScheduleId}
              href={
                quote.stripeScheduleId
                  ? `${STRIPE_DASHBOARD}/subscription_schedules/${quote.stripeScheduleId}`
                  : undefined
              }
              linkLabel="Open in Stripe"
            />
            {quote.sfContractId && (
              <IdRow
                label="Salesforce Contract"
                value={quote.sfContractId}
                href={`${SF_BASE}/lightning/r/Contract/${quote.sfContractId}/view`}
                linkLabel="Open in Salesforce"
              />
            )}
          </>
        )}

        <Separator />

        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Amount</span>
          <span className="font-medium tabular-nums">
            {quote.totalAmount != null
              ? formatCurrency(quote.totalAmount, quote.currency)
              : "---"}
          </span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Contract</span>
          <span className="font-medium">
            {quote.contractTerm ?? "---"} /{" "}
            {quote.billingFrequency ?? "---"}
          </span>
        </div>
        {quote.contractEndDate && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Contract End</span>
            <span className="font-medium">
              {formatDate(quote.contractEndDate)}
            </span>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Created</span>
          <span className="text-muted-foreground">
            {formatDateTime(quote.createdAt)}
            {quote.createdByName && ` by ${quote.createdByName}`}
          </span>
        </div>
        {quote.acceptedAt && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Accepted</span>
            <span className="text-muted-foreground">
              {formatDateTime(quote.acceptedAt)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function IdRow({
  label,
  value,
  subValue,
  href,
  linkLabel,
}: {
  label: string;
  value: string | null;
  subValue?: string | null;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      {value ? (
        <div className="flex items-center gap-1.5 overflow-hidden">
          <span className="truncate font-mono text-xs">{subValue ?? value}</span>
          {href && (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              title={linkLabel}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="size-3" />
            </a>
          )}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground/50">—</span>
      )}
    </div>
  );
}

function ValidationPanel({ quote }: { quote: QuoteDetail }) {
  const checks: { label: string; passed: boolean | null; detail?: string }[] = [
    {
      label: "Stripe quote exists",
      passed: !!quote.stripeQuoteId,
      detail: quote.stripeQuoteId,
    },
    {
      label: "Salesforce quote linked",
      passed: !!quote.sfQuoteId,
      detail: quote.sfQuoteId ?? "Not created",
    },
    {
      label: "DocuSign envelope linked",
      passed:
        quote.status === "draft" ? null : !!quote.docusignEnvelopeId,
      detail: quote.docusignEnvelopeId ?? (quote.status === "draft" ? "Pending" : "Missing"),
    },
    {
      label: "Stripe subscription created",
      passed:
        quote.status === "accepted"
          ? !!quote.stripeSubscriptionId
          : null,
      detail:
        quote.stripeSubscriptionId ??
        (quote.status === "accepted" ? "Missing" : "Pending acceptance"),
    },
    {
      label: "SF subscription ID backfilled",
      passed:
        quote.status === "accepted" && quote.sfQuoteId
          ? !!quote.stripeSubscriptionId
          : null,
      detail:
        quote.status === "accepted" && !quote.stripeSubscriptionId
          ? "Missing"
          : "N/A until accepted",
    },
    {
      label: "Stripe quote number captured",
      passed:
        quote.status === "draft" ? null : !!quote.stripeQuoteNumber,
      detail: quote.stripeQuoteNumber ?? "Pending finalization",
    },
    {
      label: "SF quote number captured",
      passed: !!quote.sfQuoteNumber,
      detail: quote.sfQuoteNumber ?? "Not captured",
    },
  ];

  const passedCount = checks.filter((c) => c.passed === true).length;
  const failedCount = checks.filter((c) => c.passed === false).length;
  const pendingCount = checks.filter((c) => c.passed === null).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Validation Checks
          </CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-emerald-600">{passedCount} passed</span>
            {failedCount > 0 && (
              <span className="text-red-600">{failedCount} failed</span>
            )}
            {pendingCount > 0 && (
              <span className="text-muted-foreground">
                {pendingCount} pending
              </span>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {checks.map((check, i) => (
          <div
            key={i}
            className="flex items-center justify-between gap-2 rounded-md border px-3 py-2"
          >
            <div className="flex items-center gap-2">
              {check.passed === true && (
                <CheckCircle2 className="size-4 text-emerald-500" />
              )}
              {check.passed === false && (
                <XCircle className="size-4 text-red-500" />
              )}
              {check.passed === null && (
                <Clock className="size-4 text-muted-foreground" />
              )}
              <span className="text-sm">{check.label}</span>
            </div>
            {check.detail && (
              <span className="max-w-[200px] truncate font-mono text-xs text-muted-foreground">
                {check.detail}
              </span>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

interface ParsedLineItem {
  productName: string;
  nickname: string;
  quantity: number;
  unitAmount: number;
  overrideUnitAmount?: number | null;
  currency: string;
  interval: string;
}

function LineItemsPanel({
  lineItemsJson,
  currency,
}: {
  lineItemsJson: unknown;
  currency: string;
}) {
  if (!lineItemsJson) return null;

  let items: ParsedLineItem[];
  try {
    items = (Array.isArray(lineItemsJson) ? lineItemsJson : JSON.parse(lineItemsJson as string)) as ParsedLineItem[];
  } catch {
    return null;
  }

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Line Items
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="pb-2 pr-4 font-medium">Product</th>
                <th className="pb-2 pr-4 font-medium text-right">Qty</th>
                <th className="pb-2 pr-4 font-medium text-right">List Price</th>
                <th className="pb-2 pr-4 font-medium text-right">Unit Price</th>
                <th className="pb-2 font-medium text-right">Line Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                const effectiveUnit = item.overrideUnitAmount ?? item.unitAmount;
                const hasDiscount =
                  item.overrideUnitAmount != null &&
                  item.overrideUnitAmount < item.unitAmount;
                const lineTotal = effectiveUnit * item.quantity;
                const cur = item.currency || currency;

                return (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <div className="font-medium">{item.productName}</div>
                      <div className="text-xs text-muted-foreground">
                        {item.nickname} &middot; {item.interval}
                      </div>
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {item.quantity}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      {formatCurrency(item.unitAmount, cur)}
                    </td>
                    <td className="py-2 pr-4 text-right tabular-nums">
                      <span className={hasDiscount ? "text-green-600" : ""}>
                        {formatCurrency(effectiveUnit, cur)}
                      </span>
                      {hasDiscount && (
                        <span className="ml-1 text-xs text-green-600">
                          ({Math.round(((item.unitAmount - effectiveUnit) / item.unitAmount) * 100)}% off)
                        </span>
                      )}
                    </td>
                    <td className="py-2 text-right font-medium tabular-nums">
                      {formatCurrency(lineTotal, cur)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan={4} className="pt-2 text-right font-medium">
                  Total
                </td>
                <td className="pt-2 text-right font-bold tabular-nums">
                  {formatCurrency(
                    items.reduce(
                      (sum, item) =>
                        sum + (item.overrideUnitAmount ?? item.unitAmount) * item.quantity,
                      0,
                    ),
                    currency,
                  )}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function LifecycleTimeline({ timeline }: { timeline: AuditTimelineEntry[] }) {
  if (timeline.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-sm text-muted-foreground">
          No audit log entries yet.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
          Lifecycle Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="relative flex flex-col gap-0">
          {timeline.map((entry, i) => {
            const isLast = i === timeline.length - 1;
            const colorClass =
              ACTION_COLORS[entry.action] ??
              "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300";

            return (
              <div key={entry.id} className="relative flex gap-4 pb-6">
                {!isLast && (
                  <div className="absolute left-[11px] top-6 h-full w-px bg-border" />
                )}
                <div className="relative z-10 mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-background ring-2 ring-border">
                  <div className="size-2 rounded-full bg-foreground/50" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colorClass}`}
                    >
                      {entry.action}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    {entry.actorName && (
                      <span className="text-xs text-muted-foreground">
                        by {entry.actorName}
                      </span>
                    )}
                  </div>
                  <TimelinePayload payload={entry.payloadJson} />
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

function TimelinePayload({ payload }: { payload: unknown }) {
  if (!payload || typeof payload !== "object") return null;

  const entries = Object.entries(payload as Record<string, unknown>).filter(
    ([key]) =>
      key !== "quoteRecordId" &&
      key !== "dryRunLog" &&
      key !== "dryRun",
  );

  if (entries.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1">
      {entries.map(([key, val]) => (
        <span key={key} className="text-xs text-muted-foreground">
          <span className="font-medium">{key}:</span>{" "}
          {typeof val === "object" ? JSON.stringify(val) : String(val)}
        </span>
      ))}
    </div>
  );
}
```

## `quotes/all/page.tsx`

```tsx
import { getAllQuotes, type QuoteRow } from "@/lib/queries/quotes";
import { QuoteListTable } from "../quote-list-table";

export default async function AllQuotesPage() {
  let quotes: QuoteRow[] = [];
  let error: string | null = null;

  try {
    quotes = await getAllQuotes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load quotes.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">All Quotes</h1>
        <p className="text-sm text-muted-foreground">
          Every quote across the team. Admin view.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <QuoteListTable quotes={quotes} />
      )}
    </div>
  );
}
```

## `quotes/co-term/configure-co-term.tsx`

```tsx
"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import {
  Loader2,
  Check,
  AlertTriangle,
  Calendar,
  CreditCard,
  Zap,
  FileText,
  CalendarClock,
  Info,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PickLineItems } from "../create/steps/pick-line-items";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getCustomerSubscriptions,
  type CustomerSubscription,
} from "@/lib/queries/customer-subscriptions";
import {
  billingIntervalToStripe,
  validBillingFrequencies,
  CONTRACT_TERM_LABELS,
  BILLING_FREQUENCY_LABELS,
  type ContractTerm,
  type BillingFrequency,
} from "@/lib/billing-utils";
import type { QuoteLineItem } from "@/lib/actions/quotes";
import type { EffectiveTiming } from "../create/steps/pick-timing";

interface Props {
  stripeCustomerId: string;
  selectedSubscription: CustomerSubscription | null;
  lineItems: QuoteLineItem[];
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  timing: EffectiveTiming;
  onSelectSubscription: (sub: CustomerSubscription) => void;
  onChangeContractTerm: (v: ContractTerm) => void;
  onChangeBillingFrequency: (v: BillingFrequency) => void;
  onChangeLineItems: (items: QuoteLineItem[]) => void;
  onChangeTiming: (t: EffectiveTiming) => void;
  onNext: () => void;
  onBack: () => void;
}

const TIMING_OPTIONS: {
  value: EffectiveTiming;
  label: string;
  icon: typeof Zap;
  description: string;
}[] = [
  {
    value: "immediate",
    label: "Immediately (prorated & charged now)",
    icon: Zap,
    description:
      "New products are added and the prorated amount is invoiced right away.",
  },
  {
    value: "next_invoice",
    label: "Immediately (proration on next invoice)",
    icon: FileText,
    description:
      "New products are added now, but the proration charge rolls into the next regular invoice.",
  },
  {
    value: "end_of_cycle",
    label: "At next billing cycle",
    icon: CalendarClock,
    description: "New products start at the next billing date. No proration.",
  },
];

function inferContractTerm(sub: CustomerSubscription): ContractTerm | null {
  if (sub.metadata?.contract_term) {
    return sub.metadata.contract_term as ContractTerm;
  }
  return null;
}

function renderSubCard(
  sub: CustomerSubscription,
  isSelected: boolean,
  onSelect: () => void,
) {
  const termLabel = sub.metadata?.contract_term
    ? CONTRACT_TERM_LABELS[sub.metadata.contract_term as ContractTerm] ?? sub.metadata.contract_term
    : null;

  return (
    <button
      key={sub.id}
      type="button"
      onClick={onSelect}
      className={`w-full rounded-lg border p-3 text-left transition-colors ${
        isSelected
          ? "border-primary bg-primary/5 ring-1 ring-primary"
          : "border-border hover:border-primary/50 hover:bg-muted/50"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-medium">{sub.id}</span>
            <Badge
              variant={sub.status === "active" ? "default" : "secondary"}
              className="text-[10px]"
            >
              {sub.status}
            </Badge>
            {termLabel && (
              <Badge variant="outline" className="text-[10px]">
                {termLabel}
              </Badge>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <CreditCard className="size-2.5" />
              {sub.collectionMethod === "send_invoice"
                ? "Invoice"
                : "Auto-charge"}
            </span>
            <span className="flex items-center gap-1">
              <Calendar className="size-2.5" />
              {formatDate(sub.currentPeriodStart)} –{" "}
              {formatDate(sub.currentPeriodEnd)}
            </span>
            <span>MRR: {formatCurrency(sub.mrr, sub.currency)}</span>
          </div>
          <div className="space-y-0.5">
            {sub.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-[11px]"
              >
                <span className="text-muted-foreground">
                  {item.productName} &times; {item.quantity}
                </span>
                <span className="tabular-nums">
                  {formatCurrency(item.unitAmount, item.currency)}
                  {item.interval ? `/${item.interval}` : ""}
                </span>
              </div>
            ))}
          </div>
        </div>
        {isSelected && (
          <div className="mt-1 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-3" />
          </div>
        )}
      </div>
    </button>
  );
}

export function ConfigureCoTerm({
  stripeCustomerId,
  selectedSubscription,
  lineItems,
  contractTerm,
  billingFrequency,
  timing,
  onSelectSubscription,
  onChangeContractTerm,
  onChangeBillingFrequency,
  onChangeLineItems,
  onChangeTiming,
  onNext,
  onBack,
}: Props) {
  const [subs, setSubs] = useState<CustomerSubscription[]>([]);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [showOther, setShowOther] = useState(false);

  useEffect(() => {
    if (!stripeCustomerId || loaded) return;
    startTransition(async () => {
      try {
        const data = await getCustomerSubscriptions(stripeCustomerId);
        setSubs(data);
        setLoaded(true);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to load subscriptions.",
        );
      }
    });
  }, [stripeCustomerId, loaded]);

  const allowedFrequencies = useMemo(
    () => validBillingFrequencies(contractTerm),
    [contractTerm],
  );

  function handleTermChange(term: ContractTerm) {
    onChangeContractTerm(term);
    const allowed = validBillingFrequencies(term);
    if (!allowed.includes(billingFrequency)) {
      onChangeBillingFrequency(allowed[0]);
    }
  }

  const eligible = subs.filter((s) => !s.cancelAtPeriodEnd && !s.cancelAt);
  const ineligible = subs.filter((s) => s.cancelAtPeriodEnd || !!s.cancelAt);

  const { interval: targetInterval, interval_count: targetCount } =
    billingIntervalToStripe(billingFrequency);

  const { matched, other } = useMemo(() => {
    const m: CustomerSubscription[] = [];
    const o: CustomerSubscription[] = [];

    for (const sub of eligible) {
      const billingMatch =
        sub.billingInterval === targetInterval &&
        sub.billingIntervalCount === targetCount;

      if (!billingMatch) {
        o.push(sub);
        continue;
      }

      const subTerm = inferContractTerm(sub);
      if (subTerm === contractTerm || subTerm === null) {
        m.push(sub);
      } else {
        o.push(sub);
      }
    }

    return { matched: m, other: o };
  }, [eligible, targetInterval, targetCount, contractTerm]);

  const canContinue = !!selectedSubscription && lineItems.length > 0;

  const selectedIsStillValid =
    selectedSubscription &&
    matched.some((s) => s.id === selectedSubscription.id);

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: Subscription picker + Timing side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: Term/Frequency selectors + Subscription list */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div>
              <h3 className="text-sm font-semibold">
                Select Subscription to Co-Term Into
              </h3>
              <p className="text-xs text-muted-foreground">
                Choose the contract term and billing frequency, then select a
                matching subscription.
              </p>
            </div>

            {/* Term + Frequency selectors */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Contract Term</Label>
                <Select
                  value={contractTerm}
                  onValueChange={(v) => handleTermChange(v as ContractTerm)}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(CONTRACT_TERM_LABELS) as ContractTerm[]).map(
                      (t) => (
                        <SelectItem key={t} value={t}>
                          {CONTRACT_TERM_LABELS[t]}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <Label className="text-xs">Billing Frequency</Label>
                <Select
                  value={billingFrequency}
                  onValueChange={(v) =>
                    onChangeBillingFrequency(v as BillingFrequency)
                  }
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allowedFrequencies.map((f) => (
                      <SelectItem key={f} value={f}>
                        {BILLING_FREQUENCY_LABELS[f]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Loading / Error / Empty states */}
            {loading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                Loading subscriptions...
              </div>
            )}

            {error && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                {error}
              </div>
            )}

            {loaded && subs.length === 0 && (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <AlertTriangle className="size-6 text-muted-foreground" />
                <p className="text-sm font-medium">No active subscriptions</p>
                <p className="text-xs text-muted-foreground">
                  This customer has no active subscriptions to amend.
                </p>
              </div>
            )}

            {/* Matching subscriptions */}
            {loaded && subs.length > 0 && matched.length === 0 && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-3 dark:border-amber-900 dark:bg-amber-950/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-300">
                      No subscriptions match
                    </p>
                    <p className="mt-0.5 text-[11px] text-amber-700 dark:text-amber-400">
                      No active subscriptions match{" "}
                      <strong>{CONTRACT_TERM_LABELS[contractTerm]}</strong> /{" "}
                      <strong>{BILLING_FREQUENCY_LABELS[billingFrequency]}</strong>.
                      Try a different term or frequency.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {matched.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Matching subscriptions ({matched.length})
                </p>
                <div className="flex max-h-[280px] flex-col gap-2 overflow-y-auto">
                  {matched.map((sub) =>
                    renderSubCard(
                      sub,
                      sub.id === selectedSubscription?.id,
                      () => onSelectSubscription(sub),
                    ),
                  )}
                </div>
              </div>
            )}

            {/* Other (non-matching) subscriptions — collapsible, read-only */}
            {other.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowOther((v) => !v)}
                  className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  {showOther ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                  Other subscriptions ({other.length})
                </button>
                {showOther && (
                  <>
                    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600" />
                        <p className="text-[11px] text-amber-800 dark:text-amber-300">
                          These subscriptions do not match the selected contract
                          term and billing frequency. They cannot be selected for
                          co-term.
                        </p>
                      </div>
                    </div>
                    <div className="flex max-h-[200px] flex-col gap-2 overflow-y-auto">
                      {other.map((sub) => (
                        <div
                          key={sub.id}
                          className="cursor-not-allowed rounded-lg border border-dashed p-3 opacity-60"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 space-y-1.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-medium">
                                  {sub.id}
                                </span>
                                <Badge
                                  variant={
                                    sub.status === "active"
                                      ? "default"
                                      : "secondary"
                                  }
                                  className="text-[10px]"
                                >
                                  {sub.status}
                                </Badge>
                                {sub.metadata?.contract_term && (
                                  <Badge variant="outline" className="text-[10px]">
                                    {CONTRACT_TERM_LABELS[
                                      sub.metadata.contract_term as ContractTerm
                                    ] ?? sub.metadata.contract_term}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <CreditCard className="size-2.5" />
                                  {sub.collectionMethod === "send_invoice"
                                    ? "Invoice"
                                    : "Auto-charge"}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Calendar className="size-2.5" />
                                  {formatDate(sub.currentPeriodStart)} –{" "}
                                  {formatDate(sub.currentPeriodEnd)}
                                </span>
                                <span>
                                  MRR: {formatCurrency(sub.mrr, sub.currency)}
                                </span>
                              </div>
                              <div className="space-y-0.5">
                                {sub.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center justify-between text-[11px]"
                                  >
                                    <span className="text-muted-foreground">
                                      {item.productName} &times; {item.quantity}
                                    </span>
                                    <span className="tabular-nums">
                                      {formatCurrency(
                                        item.unitAmount,
                                        item.currency,
                                      )}
                                      {item.interval ? `/${item.interval}` : ""}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Ineligible */}
            {ineligible.length > 0 && (
              <div className="space-y-1.5 border-t pt-3">
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  Ineligible (pending cancellation)
                </p>
                {ineligible.map((sub) => (
                  <div
                    key={sub.id}
                    className="rounded-lg border border-dashed p-2 opacity-50"
                  >
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-mono">{sub.id}</span>
                      <Badge variant="destructive" className="text-[10px]">
                        Cancelling
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Warning if selection no longer matches */}
            {selectedSubscription && !selectedIsStillValid && (
              <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900 dark:bg-amber-950/30">
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Your previously selected subscription no longer matches the
                  current filters. Please select a new one.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Timing */}
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <div>
              <h3 className="text-sm font-semibold">Effective Timing</h3>
              <p className="text-xs text-muted-foreground">
                When should the new products take effect?
              </p>
            </div>

            {selectedSubscription && selectedIsStillValid && (
              <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 dark:border-blue-900 dark:bg-blue-950/30">
                <div className="flex items-start gap-2 text-xs text-blue-800 dark:text-blue-300">
                  <Info className="mt-0.5 size-3.5 shrink-0" />
                  <span>
                    Next billing:{" "}
                    <strong>
                      {new Date(
                        selectedSubscription.currentPeriodEnd,
                      ).toLocaleDateString("en-US", {
                        month: "long",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </strong>
                  </span>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {TIMING_OPTIONS.map(
                ({ value, label, icon: Icon, description }) => {
                  const isSelected = timing === value;
                  const disabled = !selectedSubscription || !selectedIsStillValid;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => onChangeTiming(value)}
                      disabled={disabled}
                      className={`w-full rounded-lg border p-3 text-left transition-colors ${
                        disabled
                          ? "cursor-not-allowed opacity-50"
                          : isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border hover:border-primary/50 hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full ${
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          <Icon className="size-3" />
                        </div>
                        <div className="flex-1">
                          <p className="text-xs font-medium">{label}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            {description}
                          </p>
                        </div>
                      </div>
                    </button>
                  );
                },
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Line Items (full width) */}
      <Card>
        <CardContent className="pt-6">
          <PickLineItems
            embedded
            lineItems={lineItems}
            billingFrequency={billingFrequency}
            onChange={onChangeLineItems}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button
          onClick={onNext}
          disabled={!canContinue || !selectedIsStillValid}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
```

## `quotes/co-term/page.tsx`

```tsx
import { CoTermWizard } from "./wizard";

export default function CoTermQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Co-Term Amendment</h1>
        <p className="text-sm text-muted-foreground">
          Add new products to an existing subscription. The new items will co-term
          with the current contract, billed immediately (prorated) or at the next
          billing cycle.
        </p>
      </div>
      <CoTermWizard />
    </div>
  );
}
```

## `quotes/co-term/review-co-term.tsx`

```tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import {
  Loader2,
  FlaskConical,
  Rocket,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Zap,
  FileText,
  CalendarClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  BILLING_FREQUENCY_LABELS,
  convertPriceToFrequency,
  billingFrequencyIntervalLabel,
} from "@/lib/billing-utils";
import {
  createCoTermQuote,
  previewProration,
  type CoTermQuoteResult,
  type ProrationPreviewResult,
} from "@/lib/actions/co-term-quote";
import type { CreateQuoteResult } from "@/lib/actions/quotes";
import type { CoTermWizardState } from "./wizard";

interface Props {
  state: CoTermWizardState;
  onBack: () => void;
  onResult: (result: CreateQuoteResult) => void;
  onToggleDryRun: (v: boolean) => void;
}

export function ReviewCoTerm({ state, onBack, onResult, onToggleDryRun }: Props) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunLog, setDryRunLog] = useState<string[] | null>(null);
  const [logExpanded, setLogExpanded] = useState(true);
  const [proration, setProration] = useState<ProrationPreviewResult | null>(null);
  const [prorationLoading, startProration] = useTransition();

  const freqLabel = billingFrequencyIntervalLabel(state.billingFrequency);

  const isOneTime = (interval: string) =>
    !interval || interval === "one-time" || interval === "one_time";

  function toDisplay(amount: number, interval: string): number {
    if (isOneTime(interval)) return amount;
    return convertPriceToFrequency(amount, interval, state.billingFrequency);
  }

  const newTotal = state.lineItems.reduce(
    (acc, li) => acc + toDisplay(li.overrideUnitAmount ?? li.unitAmount, li.interval) * li.quantity,
    0,
  );

  const existingMrr = state.selectedSubscription?.mrr ?? 0;
  const currency = state.lineItems[0]?.currency ?? state.selectedSubscription?.currency ?? "usd";

  useEffect(() => {
    if (
      !state.selectedSubscription ||
      state.lineItems.length === 0 ||
      !state.customer?.stripeCustomerId
    )
      return;

    startProration(async () => {
      const result = await previewProration({
        stripeCustomerId: state.customer!.stripeCustomerId!,
        parentSubscriptionId: state.selectedSubscription!.id,
        parentScheduleId: state.selectedSubscription!.scheduleId,
        existingItems: state.existingItems,
        newLineItems: state.lineItems,
        billingFrequency: state.billingFrequency,
        effectiveTiming: state.effectiveTiming,
      });
      setProration(result);
    });
  }, [
    state.selectedSubscription?.id,
    state.lineItems.length,
    state.effectiveTiming,
    state.customer?.stripeCustomerId,
  ]);

  async function handleCreate() {
    if (!state.customer?.stripeCustomerId || !state.selectedSubscription) return;
    setIsExecuting(true);
    setError(null);
    setDryRunLog(null);

    try {
      const result = await createCoTermQuote({
        stripeCustomerId: state.customer.stripeCustomerId,
        customerName: state.customer.sfAccountName ?? "Unknown",
        sfAccountId: state.customer.sfAccountId ?? undefined,
        opportunityId: state.opportunityId || undefined,
        billToContactId: state.billToContactId || undefined,
        parentSubscriptionId: state.selectedSubscription.id,
        parentScheduleId: state.selectedSubscription.scheduleId,
        existingItems: state.existingItems,
        newLineItems: state.lineItems,
        billingFrequency: state.billingFrequency,
        collectionMethod: state.collectionMethod,
        daysUntilDue:
          state.collectionMethod === "send_invoice"
            ? Number.isNaN(parseInt(state.daysUntilDue, 10))
              ? 30
              : parseInt(state.daysUntilDue, 10)
            : undefined,
        effectiveTiming: state.effectiveTiming,
        expiresInDays: parseInt(state.expiresInDays, 10) || 30,
        idempotencyKey: state.idempotencyKey,
        dryRun: state.dryRun,
      });

      if (!result.success) {
        setError(result.error ?? "Unknown error");
        setIsExecuting(false);
        return;
      }

      if (result.dryRun && result.dryRunLog) {
        setDryRunLog(result.dryRunLog);
        setIsExecuting(false);
        return;
      }

      onResult({
        success: true,
        quoteRecordId: result.quoteRecordId,
        stripeQuoteId: result.stripeQuoteId,
        acceptUrl: result.acceptUrl,
        dryRun: result.dryRun,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsExecuting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Review Co-Term Amendment</h2>
        <p className="text-sm text-muted-foreground">
          Review the subscription amendment before creating the quote.
        </p>
      </div>

      {/* Subscription context */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Subscription</span>
            <span className="text-sm font-mono">{state.selectedSubscription?.id}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current MRR</span>
            <span className="text-sm">{formatCurrency(existingMrr, currency)}/mo</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Billing</span>
            <span className="text-sm">{BILLING_FREQUENCY_LABELS[state.billingFrequency]}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Current Period</span>
            <span className="text-sm">
              {state.selectedSubscription
                ? `${formatDate(state.selectedSubscription.currentPeriodStart)} – ${formatDate(state.selectedSubscription.currentPeriodEnd)}`
                : "N/A"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Schedule</span>
            <span className="text-sm font-mono">
              {state.selectedSubscription?.scheduleId ?? "None"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Existing items */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-medium mb-3">Existing Items (unchanged)</h3>
          <div className="space-y-1">
            {state.existingItems.map((item) => (
              <div key={item.subscriptionItemId} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {item.productName} &times; {item.quantity}
                </span>
                <span>
                  {formatCurrency(item.unitAmount, currency)}
                  {item.interval ? `/${item.interval}` : ""}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* New items */}
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-sm font-medium mb-3">New Items Being Added</h3>
          <div className="space-y-2">
            {state.lineItems.map((li, i) => {
              const unit = li.overrideUnitAmount ?? li.unitAmount;
              const displayed = toDisplay(unit, li.interval);
              const hasDiscount = li.overrideUnitAmount != null && li.overrideUnitAmount < li.unitAmount;
              return (
                <div key={i} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span>{li.productName} &times; {li.quantity}</span>
                    {hasDiscount && (
                      <Badge variant="secondary" className="text-xs">Discount</Badge>
                    )}
                  </div>
                  <span>
                    {formatCurrency(displayed * li.quantity, currency)}/{freqLabel}
                  </span>
                </div>
              );
            })}
          </div>
          <Separator className="my-3" />
          <div className="flex items-center justify-between text-sm font-medium">
            <span>New items total per cycle</span>
            <span>{formatCurrency(newTotal, currency)}/{freqLabel}</span>
          </div>
        </CardContent>
      </Card>

      {/* Timing & Proration */}
      <Card>
        <CardContent className="pt-6 space-y-3">
          <div className="flex items-center gap-2">
            {state.effectiveTiming === "immediate" ? (
              <Zap className="size-4 text-amber-500" />
            ) : state.effectiveTiming === "next_invoice" ? (
              <FileText className="size-4 text-indigo-500" />
            ) : (
              <CalendarClock className="size-4 text-blue-500" />
            )}
            <span className="text-sm font-medium">
              {state.effectiveTiming === "immediate"
                ? "Immediate activation (charged now)"
                : state.effectiveTiming === "next_invoice"
                  ? "Immediate activation (proration on next invoice)"
                  : "Starts at next billing cycle"}
            </span>
          </div>

          {(state.effectiveTiming === "immediate" || state.effectiveTiming === "next_invoice") && (
            <div className="rounded-md border bg-muted/30 p-3">
              {prorationLoading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Calculating proration...
                </div>
              ) : proration?.success ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>Estimated proration charge</span>
                    <span className="font-medium">
                      {formatCurrency(proration.totalProrationCents, currency)}
                    </span>
                  </div>
                  {proration.lineItems.map((line, i) => (
                    <div key={i} className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{line.description}</span>
                      <span>{formatCurrency(line.amountCents, currency)}</span>
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground/70 pt-1">
                    {state.effectiveTiming === "immediate"
                      ? "This is an estimate. A separate invoice will be generated immediately upon acceptance."
                      : "This is an estimate. The prorated amount will appear on the next regular invoice."}
                  </p>
                </div>
              ) : proration?.error ? (
                <div className="flex items-center gap-2 text-xs text-amber-600">
                  <AlertTriangle className="size-3" />
                  {proration.error}
                </div>
              ) : null}
            </div>
          )}

          {state.effectiveTiming === "end_of_cycle" && (
            <p className="text-xs text-muted-foreground">
              No proration charge. New items will be billed starting{" "}
              {state.selectedSubscription
                ? formatDate(state.selectedSubscription.currentPeriodEnd)
                : "the next billing date"}
              .
            </p>
          )}
        </CardContent>
      </Card>

      {/* Dry run toggle */}
      <div className="flex items-center gap-3 rounded-md border bg-muted/20 p-3">
        <Switch
          id="dry-run"
          checked={state.dryRun}
          onCheckedChange={onToggleDryRun}
        />
        <Label htmlFor="dry-run" className="flex flex-col gap-0.5">
          <span className="text-sm font-medium">Dry Run</span>
          <span className="text-xs text-muted-foreground">
            Simulate the co-term quote without creating real records.
          </span>
        </Label>
      </div>

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {dryRunLog && (
        <Card>
          <CardContent className="pt-4">
            <button
              type="button"
              onClick={() => setLogExpanded(!logExpanded)}
              className="flex w-full items-center gap-2 text-sm font-medium"
            >
              {logExpanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
              Dry Run Log ({dryRunLog.length} entries)
            </button>
            {logExpanded && (
              <pre className="mt-3 max-h-80 overflow-auto rounded bg-muted p-3 text-xs font-mono leading-relaxed">
                {dryRunLog.join("\n")}
              </pre>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={isExecuting}>
          {isExecuting && <Loader2 className="mr-2 size-4 animate-spin" />}
          {state.dryRun ? (
            <>
              <FlaskConical className="mr-2 size-4" />
              Dry Run
            </>
          ) : (
            <>
              <Rocket className="mr-2 size-4" />
              Create Co-Term Quote
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
```

## `quotes/co-term/wizard.tsx`

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { PickCustomer } from "../create/steps/pick-customer";
import { ConfigureCoTerm } from "./configure-co-term";
import { ReviewCoTerm } from "./review-co-term";
import { DocumentPreview } from "../create/steps/document-preview";
import { QuoteSuccess } from "../create/steps/quote-success";
import type { QuoteLineItem, CreateQuoteResult } from "@/lib/actions/quotes";
import type { CustomerSubscription } from "@/lib/queries/customer-subscriptions";
import type { ExistingSubItem } from "@/lib/actions/co-term-quote";
import type { EffectiveTiming } from "../create/steps/pick-timing";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";

const STEP_LABELS = [
  "Customer",
  "Configure",
  "Review",
  "Preview",
] as const;

const STORAGE_KEY = "co-term-wizard-session";

export interface CoTermCustomer {
  id: string;
  sfAccountId: string | null;
  sfAccountName: string | null;
  stripeCustomerId: string | null;
  domain: string | null;
}

export interface CoTermWizardState {
  customer: CoTermCustomer | null;
  opportunityId: string;
  billToContactId: string;
  selectedSubscription: CustomerSubscription | null;
  existingItems: ExistingSubItem[];
  lineItems: QuoteLineItem[];
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveTiming: EffectiveTiming;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue: string;
  expiresInDays: string;
  idempotencyKey: string;
  dryRun: boolean;
}

interface PersistedSession {
  step: number;
  state: CoTermWizardState;
  result: CreateQuoteResult | null;
  docSent: boolean;
}

function generateIdempotencyKey() {
  return `cqt_ct_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadSession(): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function saveSession(session: PersistedSession) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } catch { /* noop */ }
}

function clearSession() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch { /* noop */ }
}

const DEFAULT_STATE: CoTermWizardState = {
  customer: null,
  opportunityId: "",
  billToContactId: "",
  selectedSubscription: null,
  existingItems: [],
  lineItems: [],
  contractTerm: "1yr",
  billingFrequency: "monthly",
  effectiveTiming: "immediate",
  collectionMethod: "charge_automatically",
  daysUntilDue: "30",
  expiresInDays: "30",
  idempotencyKey: generateIdempotencyKey(),
  dryRun: true,
};

function deriveBillingFrequency(sub: CustomerSubscription): BillingFrequency {
  const interval = sub.billingInterval;
  const count = sub.billingIntervalCount;
  if (interval === "month") {
    if (count === 1) return "monthly";
    if (count === 3) return "quarterly";
    if (count === 6) return "semi_annual";
  }
  if (interval === "year") {
    if (count === 1) return "annual";
    if (count === 2) return "2yr";
    if (count === 3) return "3yr";
  }
  return "monthly";
}

export function CoTermWizard() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<CreateQuoteResult | null>(null);
  const [docSent, setDocSent] = useState(false);
  const [state, setState] = useState<CoTermWizardState>(DEFAULT_STATE);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadSession();
    if (saved) {
      setStep(saved.step);
      setResult(saved.result);
      setDocSent(saved.docSent);
      setState(saved.state);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveSession({ step, state, result, docSent });
  }, [step, state, result, docSent, hydrated]);

  const update = useCallback(
    <K extends keyof CoTermWizardState>(key: K, value: CoTermWizardState[K]) => {
      setState((prev) => ({
        ...prev,
        [key]: value,
        idempotencyKey: key === "dryRun" ? prev.idempotencyKey : generateIdempotencyKey(),
      }));
    },
    [],
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  function handleSubscriptionSelect(sub: CustomerSubscription) {
    const existing: ExistingSubItem[] = sub.items.map((item) => ({
      subscriptionItemId: item.id,
      priceId: item.priceId,
      productName: item.productName,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      interval: item.interval,
      intervalCount: item.intervalCount,
    }));

    setState((prev) => ({
      ...prev,
      selectedSubscription: sub,
      existingItems: existing,
      billingFrequency: deriveBillingFrequency(sub),
      collectionMethod: sub.collectionMethod as "charge_automatically" | "send_invoice",
      idempotencyKey: generateIdempotencyKey(),
    }));
  }

  function handleQuoteResult(r: CreateQuoteResult) {
    setResult(r);
    setStep(3);
  }

  function handleDocSent() {
    setDocSent(true);
    clearSession();
  }

  function handleStartNew() {
    clearSession();
    setStep(0);
    setResult(null);
    setDocSent(false);
    setState({ ...DEFAULT_STATE, idempotencyKey: generateIdempotencyKey() });
  }

  if (!hydrated) return null;

  if (docSent && result?.success) {
    return <QuoteSuccess result={result} state={state as any} onStartNew={handleStartNew} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <nav aria-label="Wizard progress" className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`mx-1 h-px w-6 ${i <= step ? "bg-foreground" : "bg-border"}`}
              />
            )}
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-default"
              }`}
            >
              <span>{i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        ))}
        {step > 0 && (
          <button
            type="button"
            onClick={handleStartNew}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Start Over
          </button>
        )}
      </nav>

      {step === 0 && (
        <PickCustomer
          quoteType="Expansion"
          selected={state.customer}
          opportunityId={state.opportunityId}
          billToContactId={state.billToContactId}
          contractMode="co_term"
          onSelect={(c) => update("customer", c as CoTermWizardState["customer"])}
          onOpportunityChange={(v) => update("opportunityId", v)}
          onBillToContactChange={(v) => update("billToContactId", v)}
          onContractModeChange={() => {/* co-term wizard is always co_term */}}
          onNext={next}
        />
      )}
      {step === 1 && state.customer?.stripeCustomerId && (
        <ConfigureCoTerm
          stripeCustomerId={state.customer.stripeCustomerId}
          selectedSubscription={state.selectedSubscription}
          lineItems={state.lineItems}
          contractTerm={state.contractTerm}
          billingFrequency={state.billingFrequency}
          timing={state.effectiveTiming}
          onSelectSubscription={handleSubscriptionSelect}
          onChangeContractTerm={(v) => update("contractTerm", v)}
          onChangeBillingFrequency={(v) => update("billingFrequency", v)}
          onChangeLineItems={(items) => update("lineItems", items)}
          onChangeTiming={(t) => update("effectiveTiming", t)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && (
        <ReviewCoTerm
          state={state}
          onBack={back}
          onResult={handleQuoteResult}
          onToggleDryRun={(v) => update("dryRun", v)}
        />
      )}
      {step === 3 && result && (
        <DocumentPreview
          result={result}
          onSent={handleDocSent}
          onBack={async () => {
            setResult(null);
            setState((prev) => ({ ...prev, idempotencyKey: generateIdempotencyKey() }));
            setStep(2);
          }}
        />
      )}
    </div>
  );
}
```

## `quotes/create/amendment/page.tsx`

```tsx
import { QuoteWizard } from "../wizard";

export default function AmendmentQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Amendment Quote</h1>
        <p className="text-sm text-muted-foreground">
          Create an amendment quote to modify an existing contract mid-term.
        </p>
      </div>
      <QuoteWizard quoteType="Amendment" storageKey="quote-wizard-amendment" />
    </div>
  );
}
```

## `quotes/create/expansion/page.tsx`

```tsx
import { QuoteWizard } from "../wizard";

export default function ExpansionQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Expansion Quote</h1>
        <p className="text-sm text-muted-foreground">
          Create an expansion quote for an existing customer to add seats,
          modules, or upgrades.
        </p>
      </div>
      <QuoteWizard quoteType="Expansion" storageKey="quote-wizard-expansion" />
    </div>
  );
}
```

## `quotes/create/page.tsx`

```tsx
import { QuoteWizard } from "./wizard";

export default function CreateQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">New Quote</h1>
        <p className="text-sm text-muted-foreground">
          Build a Stripe quote with line items, payment terms, and send it to
          the customer for acceptance.
        </p>
      </div>
      <QuoteWizard quoteType="New" />
    </div>
  );
}
```

## `quotes/create/renewal/page.tsx`

```tsx
import { QuoteWizard } from "../wizard";

export default function RenewalQuotePage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Renewal Quote</h1>
        <p className="text-sm text-muted-foreground">
          Create a renewal quote to extend a customer&apos;s existing contract.
        </p>
      </div>
      <QuoteWizard quoteType="Renewal" storageKey="quote-wizard-renewal" />
    </div>
  );
}
```

## `quotes/create/steps/configure-quote.tsx`

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PickTerms } from "./pick-terms";
import { PickPaymentPath } from "./pick-payment-path";
import { PickLineItems } from "./pick-line-items";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";
import type { QuoteLineItem } from "@/lib/actions/quotes";

interface Props {
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveDate: string;
  trialPeriodDays: string;
  expiresInDays: string;
  lineItems: QuoteLineItem[];
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue: string;
  onChangeContractTerm: (v: ContractTerm) => void;
  onChangeBillingFrequency: (v: BillingFrequency) => void;
  onChangeEffectiveDate: (v: string) => void;
  onChangeTrialDays: (v: string) => void;
  onChangeExpiresIn: (v: string) => void;
  onChangeLineItems: (items: QuoteLineItem[]) => void;
  onChangeMethod: (v: "charge_automatically" | "send_invoice") => void;
  onChangeDays: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function ConfigureQuote({
  contractTerm,
  billingFrequency,
  effectiveDate,
  trialPeriodDays,
  expiresInDays,
  lineItems,
  collectionMethod,
  daysUntilDue,
  onChangeContractTerm,
  onChangeBillingFrequency,
  onChangeEffectiveDate,
  onChangeTrialDays,
  onChangeExpiresIn,
  onChangeLineItems,
  onChangeMethod,
  onChangeDays,
  onNext,
  onBack,
}: Props) {
  const expDays = parseInt(expiresInDays, 10);
  const termsValid = !isNaN(expDays) && expDays > 0;

  const paymentMode = collectionMethod === "charge_automatically" ? "pay_now" : "send_invoice";
  const paymentValid =
    paymentMode === "pay_now" ||
    (daysUntilDue === "0" || parseInt(daysUntilDue, 10) > 0);

  const canContinue = termsValid && paymentValid && lineItems.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Top row: Terms + Payment side-by-side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="border-b">
            <CardTitle>Contract Terms</CardTitle>
          </CardHeader>
          <CardContent>
            <PickTerms
              embedded
              contractTerm={contractTerm}
              billingFrequency={billingFrequency}
              effectiveDate={effectiveDate}
              trialPeriodDays={trialPeriodDays}
              expiresInDays={expiresInDays}
              lineItems={lineItems}
              onChangeContractTerm={onChangeContractTerm}
              onChangeBillingFrequency={onChangeBillingFrequency}
              onChangeEffectiveDate={onChangeEffectiveDate}
              onChangeTrialDays={onChangeTrialDays}
              onChangeExpiresIn={onChangeExpiresIn}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b">
            <CardTitle>Payment Path</CardTitle>
          </CardHeader>
          <CardContent>
            <PickPaymentPath
              embedded
              collectionMethod={collectionMethod}
              daysUntilDue={daysUntilDue}
              onChangeMethod={onChangeMethod}
              onChangeDays={onChangeDays}
            />
          </CardContent>
        </Card>
      </div>

      {/* Bottom: Line Items (full width) */}
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Line Items</CardTitle>
        </CardHeader>
        <CardContent className="pt-5">
          <PickLineItems
            embedded
            lineItems={lineItems}
            billingFrequency={billingFrequency}
            onChange={onChangeLineItems}
          />
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!canContinue}>
          Continue
        </Button>
      </div>
    </div>
  );
}
```

## `quotes/create/steps/document-preview.tsx`

```tsx
"use client";

import { useState } from "react";
import {
  Loader2,
  Send,
  ArrowLeft,
  AlertCircle,
  FileText,
  UserCheck,
  Eye,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  preparePdfForPreview,
  createAndSendEnvelope,
} from "@/lib/actions/docusign-preview";
import { finalizeStripeQuote, type CreateQuoteResult } from "@/lib/actions/quotes";

interface Props {
  result: CreateQuoteResult;
  onSent: () => void;
  onBack: () => void;
}

export function DocumentPreview({ result, onSent, onBack }: Props) {
  const [signerName, setSignerName] = useState("");
  const [signerEmail, setSignerEmail] = useState("");
  const [pdfBase64, setPdfBase64] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [envelopeId, setEnvelopeId] = useState<string | null>(null);

  const isDryRun = result.dryRun ?? false;

  async function handleGeneratePreview() {
    if (!result.quoteRecordId) return;
    setCreating(true);
    setError(null);

    const res = await preparePdfForPreview(
      result.quoteRecordId,
      signerName.trim(),
      signerEmail.trim(),
    );

    if (!res.success) {
      setError(res.error ?? "Failed to generate PDF preview.");
      setCreating(false);
      return;
    }

    setPdfBase64(res.pdfBase64 ?? "");
    setCreating(false);
  }

  async function handleSend() {
    if (!result.quoteRecordId) return;

    if (isDryRun) {
      onSent();
      return;
    }

    setSending(true);
    setError(null);

    const res = await createAndSendEnvelope(result.quoteRecordId);
    if (!res.success) {
      setError(res.error ?? "Failed to send document.");
      setSending(false);
      return;
    }

    setEnvelopeId(res.envelopeId ?? null);
    setSent(true);
    setSending(false);
    onSent();
  }

  const [skipping, setSkipping] = useState(false);

  async function handleSkipDocument() {
    if (!result.quoteRecordId) return;
    setSkipping(true);
    setError(null);

    if (!isDryRun) {
      const finRes = await finalizeStripeQuote(result.quoteRecordId);
      if (!finRes.success) {
        setError(finRes.error ?? "Failed to finalize Stripe quote.");
        setSkipping(false);
        return;
      }
    }

    setSkipping(false);
    onSent();
  }

  const signerValid =
    signerName.trim().length > 0 && signerEmail.trim().includes("@");
  const showSignerForm = pdfBase64 === null;
  const showPreview = pdfBase64 !== null;

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1.5">
            <CardTitle>
              {showSignerForm
                ? "Document Signer"
                : "Preview Quote Document"}
            </CardTitle>
            <CardDescription>
              {showSignerForm
                ? "Enter the signer details, then generate the PDF for review."
                : "Review the Stripe quote PDF below before sending via DocuSign."}
            </CardDescription>
          </div>
          <Badge variant="outline" className="gap-1">
            {showSignerForm ? (
              <>
                <UserCheck className="size-3" />
                Signer
              </>
            ) : (
              <>
                <Eye className="size-3" />
                Preview
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">

        {showSignerForm && (
          <>
            {isDryRun && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-4 py-3">
                <p className="text-sm text-amber-700">
                  Dry run mode — no document will be created. Enter signer info
                  to continue.
                </p>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signer-name">Signer Name</Label>
                <Input
                  id="signer-name"
                  placeholder="e.g. Jane Smith"
                  value={signerName}
                  onChange={(e) => setSignerName(e.target.value)}
                  autoFocus
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="signer-email">Signer Email</Label>
                <Input
                  id="signer-email"
                  type="email"
                  placeholder="e.g. jane@company.com"
                  value={signerEmail}
                  onChange={(e) => setSignerEmail(e.target.value)}
                />
              </div>
            </div>
          </>
        )}

        {showPreview && isDryRun && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 px-4 py-3">
            <p className="text-sm text-amber-700">
              Dry run mode — no document was created. Click &ldquo;Continue&rdquo;
              to proceed.
            </p>
          </div>
        )}

        {showPreview && !isDryRun && pdfBase64 && (
          <div className="overflow-hidden rounded-lg border bg-white">
            <embed
              src={`data:application/pdf;base64,${pdfBase64}`}
              type="application/pdf"
              width="100%"
              height="700"
              className="block"
            />
          </div>
        )}

        {sent && envelopeId && (
          <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-50/50 px-4 py-3">
            <CheckCircle2 className="size-4 text-green-600" />
            <p className="text-sm text-green-700">
              DocuSign envelope created: {envelopeId}
            </p>
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

      </CardContent>
      <CardFooter className="justify-between border-t">
        <Button
          variant="outline"
          onClick={onBack}
          disabled={creating || sending || sent}
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>

        {showSignerForm ? (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleSkipDocument}
              disabled={skipping}
            >
              {skipping ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Finalizing...
                </>
              ) : (
                "Skip (No Document)"
              )}
            </Button>
            <Button
              onClick={handleGeneratePreview}
              disabled={!signerValid || creating}
            >
              {creating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating PDF...
                </>
              ) : (
                <>
                  <FileText className="size-4" />
                  Generate &amp; Preview
                </>
              )}
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleSend}
            disabled={sending || sent}
          >
            {sending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Sending...
              </>
            ) : isDryRun ? (
              "Continue"
            ) : (
              <>
                <Send className="size-4" />
                Approve &amp; Send via DocuSign
              </>
            )}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
```

## `quotes/create/steps/pick-bill-to-contact.tsx`

```tsx
"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, ArrowRight, Plus, User, Mail, Phone, Briefcase, Check } from "lucide-react";
import { getAccountContacts } from "@/lib/queries/contacts";
import { createContact, setBillToContact } from "@/lib/actions/contacts";
import type { AccountContact } from "@/lib/queries/contacts";

interface Props {
  sfAccountId: string;
  billToContactId: string;
  onChange: (contactId: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PickBillToContact({ sfAccountId, billToContactId, onChange, onNext, onBack }: Props) {
  const [contacts, setContacts] = useState<AccountContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState(billToContactId);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);
  const [setting, setSetting] = useState(false);

  // New contact form
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    title: "",
    phone: "",
  });

  useEffect(() => {
    if (!sfAccountId) return;
    
    loadContacts();
  }, [sfAccountId]);

  async function loadContacts() {
    setLoading(true);
    setError(null);
    
    try {
      const result = await getAccountContacts(sfAccountId);
      setContacts(result);
      
      // If there's already a Bill-To contact, select it
      const currentBillTo = result.find(c => c.isBillTo);
      if (currentBillTo && !selectedContactId) {
        setSelectedContactId(currentBillTo.id);
        onChange(currentBillTo.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateContact() {
    if (!newContact.firstName.trim() || !newContact.lastName.trim() || !newContact.email.trim()) {
      return;
    }

    setCreating(true);
    
    try {
      const result = await createContact({
        sfAccountId,
        firstName: newContact.firstName,
        lastName: newContact.lastName,
        email: newContact.email,
        title: newContact.title || undefined,
        phone: newContact.phone || undefined,
      });

      if (result.success && result.contactId) {
        // Add to local list
        const newContactData: AccountContact = {
          id: result.contactId,
          firstName: newContact.firstName,
          lastName: newContact.lastName,
          email: newContact.email,
          title: newContact.title || undefined,
          phone: newContact.phone || undefined,
          isBillTo: false,
        };
        
        setContacts(prev => [...prev, newContactData]);
        setSelectedContactId(result.contactId);
        onChange(result.contactId);
        
        // Reset form and close dialog
        setNewContact({ firstName: "", lastName: "", email: "", title: "", phone: "" });
        setShowCreateDialog(false);
      } else {
        setError(result.error || "Failed to create contact");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create contact");
    } finally {
      setCreating(false);
    }
  }

  async function handleNext() {
    if (!selectedContactId) return;

    setSetting(true);
    
    try {
      const result = await setBillToContact(sfAccountId, selectedContactId);
      if (result.success) {
        onNext();
      } else {
        setError(result.error || "Failed to set Bill-To Contact");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set Bill-To Contact");
    } finally {
      setSetting(false);
    }
  }

  function handleSelectContact(contactId: string) {
    setSelectedContactId(contactId);
    onChange(contactId);
    setError(null);
  }

  const isFormValid = newContact.firstName.trim() && newContact.lastName.trim() && newContact.email.trim();

  if (!sfAccountId) {
    return (
      <Card>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">Please select a customer first.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="size-5" />
          Select Bill-To Contact
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose the contact who will receive invoices and billing communications.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Loading contacts...</p>
          </div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground mb-4">No contacts found for this account.</p>
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="size-4 mr-2" />
                  Create New Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New Contact</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="firstName">First Name *</Label>
                      <Input
                        id="firstName"
                        value={newContact.firstName}
                        onChange={(e) => setNewContact(prev => ({ ...prev, firstName: e.target.value }))}
                        placeholder="John"
                      />
                    </div>
                    <div>
                      <Label htmlFor="lastName">Last Name *</Label>
                      <Input
                        id="lastName"
                        value={newContact.lastName}
                        onChange={(e) => setNewContact(prev => ({ ...prev, lastName: e.target.value }))}
                        placeholder="Smith"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="email">Email *</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="john.smith@company.com"
                    />
                  </div>
                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={newContact.title}
                      onChange={(e) => setNewContact(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="Finance Manager"
                    />
                  </div>
                  <div>
                    <Label htmlFor="phone">Phone</Label>
                    <Input
                      id="phone"
                      value={newContact.phone}
                      onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                      Cancel
                    </Button>
                    <Button onClick={handleCreateContact} disabled={!isFormValid || creating}>
                      {creating ? "Creating..." : "Create Contact"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-medium">Available Contacts</h3>
              <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="size-4 mr-2" />
                    Add New
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create New Contact</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="firstName">First Name *</Label>
                        <Input
                          id="firstName"
                          value={newContact.firstName}
                          onChange={(e) => setNewContact(prev => ({ ...prev, firstName: e.target.value }))}
                          placeholder="John"
                        />
                      </div>
                      <div>
                        <Label htmlFor="lastName">Last Name *</Label>
                        <Input
                          id="lastName"
                          value={newContact.lastName}
                          onChange={(e) => setNewContact(prev => ({ ...prev, lastName: e.target.value }))}
                          placeholder="Smith"
                        />
                      </div>
                    </div>
                    <div>
                      <Label htmlFor="email">Email *</Label>
                      <Input
                        id="email"
                        type="email"
                        value={newContact.email}
                        onChange={(e) => setNewContact(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="john.smith@company.com"
                      />
                    </div>
                    <div>
                      <Label htmlFor="title">Title</Label>
                      <Input
                        id="title"
                        value={newContact.title}
                        onChange={(e) => setNewContact(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="Finance Manager"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={newContact.phone}
                        onChange={(e) => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                        placeholder="(555) 123-4567"
                      />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button onClick={handleCreateContact} disabled={!isFormValid || creating}>
                        {creating ? "Creating..." : "Create Contact"}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="grid gap-3">
              {contacts.map((contact) => (
                <div
                  key={contact.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    selectedContactId === contact.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => handleSelectContact(contact.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium">
                          {contact.firstName} {contact.lastName}
                        </h4>
                        {contact.isBillTo && (
                          <Badge variant="secondary" className="text-xs">
                            Current Bill-To
                          </Badge>
                        )}
                        {selectedContactId === contact.id && (
                          <Check className="size-4 text-primary" />
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Mail className="size-3" />
                          {contact.email}
                        </div>
                        {contact.title && (
                          <div className="flex items-center gap-2">
                            <Briefcase className="size-3" />
                            {contact.title}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2">
                            <Phone className="size-3" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-4">
          <Button variant="outline" onClick={onBack}>
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <Button 
            onClick={handleNext} 
            disabled={!selectedContactId || setting}
          >
            {setting ? "Setting..." : "Continue"}
            <ArrowRight className="size-4 ml-2" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}```

## `quotes/create/steps/pick-customer.tsx`

```tsx
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
  process.env.NEXT_PUBLIC_SF_ORG_URL ?? "https://yourorg.lightning.force.com";

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
            <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
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
                      className="flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors hover:bg-muted/50"
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
              <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
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
                className={`flex flex-col gap-1 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
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
                className={`flex flex-col gap-1 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
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
```

## `quotes/create/steps/pick-line-items.tsx`

```tsx
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
```

## `quotes/create/steps/pick-payment-path.tsx`

```tsx
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
```

## `quotes/create/steps/pick-subscription.tsx`

```tsx
"use client";

import { useState, useEffect, useTransition } from "react";
import { Loader2, Check, AlertTriangle, Calendar, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  getCustomerSubscriptions,
  type CustomerSubscription,
} from "@/lib/queries/customer-subscriptions";

interface Props {
  stripeCustomerId: string;
  selectedSubscriptionId: string | null;
  onSelect: (sub: CustomerSubscription) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PickSubscription({
  stripeCustomerId,
  selectedSubscriptionId,
  onSelect,
  onNext,
  onBack,
}: Props) {
  const [subs, setSubs] = useState<CustomerSubscription[]>([]);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!stripeCustomerId || loaded) return;
    startTransition(async () => {
      try {
        const data = await getCustomerSubscriptions(stripeCustomerId);
        setSubs(data);
        setLoaded(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load subscriptions.");
      }
    });
  }, [stripeCustomerId, loaded]);

  const eligible = subs.filter(
    (s) => !s.cancelAtPeriodEnd && !s.cancelAt,
  );
  const ineligible = subs.filter(
    (s) => s.cancelAtPeriodEnd || !!s.cancelAt,
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">Select Subscription</h2>
        <p className="text-sm text-muted-foreground">
          Choose the active subscription you want to add products to.
        </p>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading subscriptions...
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loaded && subs.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <AlertTriangle className="size-8 text-muted-foreground" />
            <p className="font-medium">No active subscriptions found</p>
            <p className="text-sm text-muted-foreground">
              This customer has no active or trialing subscriptions to amend.
            </p>
          </CardContent>
        </Card>
      )}

      {eligible.length > 0 && (
        <div className="flex flex-col gap-3">
          {eligible.map((sub) => {
            const selected = sub.id === selectedSubscriptionId;
            return (
              <button
                key={sub.id}
                type="button"
                onClick={() => onSelect(sub)}
                className={`w-full rounded-lg border p-4 text-left transition-colors ${
                  selected
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm font-mono">{sub.id}</span>
                      <Badge variant={sub.status === "active" ? "default" : "secondary"}>
                        {sub.status}
                      </Badge>
                      {sub.scheduleId && (
                        <Badge variant="outline" className="text-xs">
                          Schedule
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <CreditCard className="size-3" />
                        {sub.collectionMethod === "send_invoice" ? "Invoice" : "Auto-charge"}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="size-3" />
                        Period: {formatDate(sub.currentPeriodStart)} – {formatDate(sub.currentPeriodEnd)}
                      </span>
                      <span>
                        MRR: {formatCurrency(sub.mrr, sub.currency)}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {sub.items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {item.productName} &times; {item.quantity}
                          </span>
                          <span>
                            {formatCurrency(item.unitAmount, item.currency)}
                            {item.interval ? `/${item.interval}` : ""}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                  {selected && (
                    <div className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Check className="size-3.5" />
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {ineligible.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Ineligible (pending cancellation)
          </p>
          {ineligible.map((sub) => (
            <div
              key={sub.id}
              className="rounded-lg border border-dashed p-3 opacity-60"
            >
              <div className="flex items-center gap-2 text-sm">
                <span className="font-mono text-xs">{sub.id}</span>
                <Badge variant="destructive">Cancelling</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cannot add products to a subscription pending cancellation.
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext} disabled={!selectedSubscriptionId}>
          Continue
        </Button>
      </div>
    </div>
  );
}
```

## `quotes/create/steps/pick-terms.tsx`

```tsx
"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/format";
import {
  CONTRACT_TERM_LABELS,
  BILLING_FREQUENCY_LABELS,
  validBillingFrequencies,
  computeIterations,
  convertPriceToFrequency,
  computeContractEndDate,
  formatBillingCycleSummary,
} from "@/lib/billing-utils";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";
import type { QuoteLineItem } from "@/lib/actions/quotes";

interface Props {
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveDate: string;
  trialPeriodDays: string;
  expiresInDays: string;
  lineItems: QuoteLineItem[];
  onChangeContractTerm: (v: ContractTerm) => void;
  onChangeBillingFrequency: (v: BillingFrequency) => void;
  onChangeEffectiveDate: (v: string) => void;
  onChangeTrialDays: (v: string) => void;
  onChangeExpiresIn: (v: string) => void;
  onNext?: () => void;
  onBack?: () => void;
  embedded?: boolean;
}

export function PickTerms({
  contractTerm,
  billingFrequency,
  effectiveDate,
  trialPeriodDays,
  expiresInDays,
  lineItems,
  onChangeContractTerm,
  onChangeBillingFrequency,
  onChangeEffectiveDate,
  onChangeTrialDays,
  onChangeExpiresIn,
  onNext,
  onBack,
  embedded,
}: Props) {
  const expDays = parseInt(expiresInDays, 10);
  const isValid = !isNaN(expDays) && expDays > 0;

  const allowedFrequencies = useMemo(
    () => validBillingFrequencies(contractTerm),
    [contractTerm],
  );

  function handleTermChange(term: ContractTerm) {
    onChangeContractTerm(term);
    const allowed = validBillingFrequencies(term);
    if (!allowed.includes(billingFrequency)) {
      onChangeBillingFrequency(allowed[0]);
    }
  }

  const iterations = computeIterations(contractTerm, billingFrequency);
  const cycleSummary = formatBillingCycleSummary(contractTerm, billingFrequency);

  const startDate = effectiveDate ? new Date(effectiveDate) : new Date();
  const endDate = computeContractEndDate(startDate, contractTerm);

  const recurringItems = lineItems.filter(
    (li) => li.interval && li.interval !== "one-time" && li.interval !== "one_time",
  );
  const oneTimeItems = lineItems.filter(
    (li) => !li.interval || li.interval === "one-time" || li.interval === "one_time",
  );

  const perCycleTotal = recurringItems.reduce((acc, li) => {
    const eff = li.overrideUnitAmount ?? li.unitAmount;
    const converted = convertPriceToFrequency(eff, li.interval, billingFrequency);
    return acc + converted * li.quantity;
  }, 0);

  const oneTimeTotal = oneTimeItems.reduce((acc, li) => {
    const eff = li.overrideUnitAmount ?? li.unitAmount;
    return acc + eff * li.quantity;
  }, 0);

  const currency = lineItems[0]?.currency ?? "usd";

  const content = (
    <>
      {!embedded && (
        <div>
          <h2 className="text-lg font-semibold">Contract Terms</h2>
          <p className="text-sm text-muted-foreground">
            Set the contract length, billing frequency, and subscription dates.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label>Contract Term</Label>
          <Select
            value={contractTerm}
            onValueChange={(v) => handleTermChange(v as ContractTerm)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(CONTRACT_TERM_LABELS) as ContractTerm[]).map(
                (t) => (
                  <SelectItem key={t} value={t}>
                    {CONTRACT_TERM_LABELS[t]}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-2">
          <Label>Billing Frequency</Label>
          <Select
            value={billingFrequency}
            onValueChange={(v) =>
              onChangeBillingFrequency(v as BillingFrequency)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {allowedFrequencies.map((f) => (
                <SelectItem key={f} value={f}>
                  {BILLING_FREQUENCY_LABELS[f]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-sm font-medium">{cycleSummary}</p>
        <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span>
            {iterations} billing cycle{iterations > 1 ? "s" : ""}
          </span>
          <span>
            Ends:{" "}
            {endDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
          {recurringItems.length > 0 && (
            <span>
              Per cycle: {formatCurrency(perCycleTotal, currency)}
            </span>
          )}
        </div>
        {recurringItems.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {recurringItems.map((li) => {
              const eff = li.overrideUnitAmount ?? li.unitAmount;
              const converted = convertPriceToFrequency(
                eff,
                li.interval,
                billingFrequency,
              );
              return (
                <Badge key={li.priceId} variant="outline" className="font-mono text-xs">
                  {li.productName}: {formatCurrency(converted, li.currency)}/
                  {BILLING_FREQUENCY_LABELS[billingFrequency].toLowerCase().replace("every ", "")}
                </Badge>
              );
            })}
          </div>
        )}
        {oneTimeItems.length > 0 && (
          <p className="mt-2 text-xs text-muted-foreground">
            + {formatCurrency(oneTimeTotal, currency)} one-time (charged on
            first invoice)
          </p>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2">
          <Label htmlFor="eff-date">
            Subscription Effective Date{" "}
            <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="eff-date"
            type="date"
            value={effectiveDate}
            onChange={(e) => onChangeEffectiveDate(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave blank to start immediately upon acceptance. Future dates
            create a subscription schedule.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="trial-days">
            Trial Period{" "}
            <span className="text-muted-foreground">(days, optional)</span>
          </Label>
          <Input
            id="trial-days"
            type="number"
            min="0"
            placeholder="0"
            value={trialPeriodDays}
            onChange={(e) => onChangeTrialDays(e.target.value)}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="exp-days">Quote Expiration (days)</Label>
        <Input
          id="exp-days"
          type="number"
          min="1"
          value={expiresInDays}
          onChange={(e) => onChangeExpiresIn(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          The quote will automatically cancel if not accepted within this many
          days.
        </p>
      </div>
    </>
  );

  if (embedded) {
    return <div className="flex flex-col gap-5">{content}</div>;
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Contract Terms</CardTitle>
        <CardDescription>
          Set the contract length, billing frequency, and subscription dates.
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
```

## `quotes/create/steps/pick-timing.tsx`

```tsx
"use client";

import { Zap, CalendarClock, FileText, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EffectiveTiming = "immediate" | "next_invoice" | "end_of_cycle";

interface Props {
  timing: EffectiveTiming;
  nextBillingDate: string;
  onChange: (t: EffectiveTiming) => void;
  onNext: () => void;
  onBack: () => void;
}

const OPTIONS: {
  value: EffectiveTiming;
  label: string;
  icon: typeof Zap;
  description: string;
  detail: string;
}[] = [
  {
    value: "immediate",
    label: "Immediately (prorated & charged now)",
    icon: Zap,
    description: "New products are added and the prorated amount is invoiced right away.",
    detail:
      "Stripe will generate a separate prorated invoice for the partial period and charge it immediately. Use this when the customer expects an instant charge.",
  },
  {
    value: "next_invoice",
    label: "Immediately (proration on next invoice)",
    icon: FileText,
    description: "New products are added now, but the proration charge rolls into the next regular invoice.",
    detail:
      "Products activate immediately. The prorated amount is added as a pending line item and collected on the next scheduled invoice. Ideal for customers with third-party AP systems that expect charges on regular billing cycles.",
  },
  {
    value: "end_of_cycle",
    label: "At next billing cycle",
    icon: CalendarClock,
    description: "New products start at the next billing date.",
    detail:
      "No proration is charged. The new items will appear on the subscription starting from the next billing cycle and be included in the regular invoice.",
  },
];

export function PickTiming({
  timing,
  nextBillingDate,
  onChange,
  onNext,
  onBack,
}: Props) {
  const formattedDate = new Date(nextBillingDate).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-lg font-semibold">When should the new products take effect?</h2>
        <p className="text-sm text-muted-foreground">
          Choose when the added products should be activated on the subscription.
        </p>
      </div>

      <div className="rounded-md border border-blue-200 bg-blue-50 px-4 py-3 dark:border-blue-900 dark:bg-blue-950/30">
        <div className="flex items-start gap-2 text-sm text-blue-800 dark:text-blue-300">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Next billing date for this subscription: <strong>{formattedDate}</strong>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        {OPTIONS.map(({ value, label, icon: Icon, description, detail }) => {
          const selected = timing === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => onChange(value)}
              className={`w-full rounded-lg border p-4 text-left transition-colors ${
                selected
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${
                    selected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Icon className="size-4" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
                  {selected && (
                    <p className="mt-2 text-xs text-muted-foreground/80 leading-relaxed">
                      {detail}
                    </p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 pt-2">
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onNext}>Continue</Button>
      </div>
    </div>
  );
}
```

## `quotes/create/steps/quote-success.tsx`

```tsx
"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink, Copy, Check, FlaskConical, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import type { CreateQuoteResult } from "@/lib/actions/quotes";
import type { QuoteWizardState } from "../wizard";

interface Props {
  result: CreateQuoteResult;
  state: QuoteWizardState;
  onStartNew?: () => void;
}

export function QuoteSuccess({ result, state, onStartNew }: Props) {
  const [copied, setCopied] = useState(false);
  const [logExpanded, setLogExpanded] = useState(true);
  const isMock = result.stripeQuoteId?.includes("mock") ?? false;
  const isDryRun = result.dryRun ?? false;
  const dashboardBase = "https://dashboard.stripe.com";

  const total = state.lineItems.reduce(
    (acc, li) => acc + (li.overrideUnitAmount ?? li.unitAmount) * li.quantity,
    0,
  );

  const acceptUrl = result.acceptUrl
    ? `${typeof window !== "undefined" ? window.location.origin : ""}${result.acceptUrl}`
    : null;

  function copyAcceptUrl() {
    if (!acceptUrl) return;
    navigator.clipboard.writeText(acceptUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 pb-8 pt-8">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">
            {isDryRun ? "Dry Run Complete" : "Quote Created"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.customer?.sfAccountName} &mdash;{" "}
            {formatCurrency(total, state.lineItems[0]?.currency ?? "usd")}{" "}
            {state.collectionMethod === "charge_automatically"
              ? "(prepay)"
              : "(invoice)"}
          </p>
          {isDryRun && (
            <Badge variant="outline" className="mt-2 gap-1 text-amber-600 border-amber-400">
              <FlaskConical className="size-3" />
              No real resources created
            </Badge>
          )}
        </div>

        {isMock && !isDryRun && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800">
            Mock mode &mdash; no real Stripe quote was created.
          </div>
        )}

        {result.dryRunLog && result.dryRunLog.length > 0 && (
          <div className="w-full max-w-md rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
            <button
              type="button"
              onClick={() => setLogExpanded((v) => !v)}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Dry Run Log ({result.dryRunLog.length} entries)
              </span>
              {logExpanded ? (
                <ChevronDown className="size-4 text-amber-600" />
              ) : (
                <ChevronRight className="size-4 text-amber-600" />
              )}
            </button>
            {logExpanded && (
              <div className="max-h-60 overflow-y-auto border-t border-amber-500/20 px-4 py-3">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                  {result.dryRunLog.join("\n")}
                </pre>
              </div>
            )}
          </div>
        )}

        {acceptUrl && (
          <div className="w-full max-w-md">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Customer Acceptance Link
            </p>
            <div className="flex items-center gap-2 rounded-lg border bg-muted/50 px-4 py-3">
              <code className="flex-1 truncate text-xs">{acceptUrl}</code>
              <Button variant="ghost" size="sm" onClick={copyAcceptUrl}>
                {copied ? (
                  <Check className="size-4 text-emerald-600" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Send this link to the customer to review and accept the quote.
            </p>
          </div>
        )}

        <div className="w-full max-w-md space-y-3">
          {result.stripeQuoteId && (
            <ResourceLink
              label="Stripe Quote"
              id={result.stripeQuoteId}
              href={
                isMock || isDryRun
                  ? undefined
                  : `${dashboardBase}/quotes/${result.stripeQuoteId}`
              }
            />
          )}
          {result.sfQuoteId && (
            <ResourceLink label="SF Quote (Stripe_Quote__c)" id={result.sfQuoteId} />
          )}
          {result.quoteRecordId && (
            <ResourceLink label="Quote Record" id={result.quoteRecordId} />
          )}
          {result.auditLogId && (
            <ResourceLink label="Audit Log" id={result.auditLogId} />
          )}
        </div>

        <Separator />

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href="/quotes">View All Quotes</Link>
          </Button>
          {onStartNew ? (
            <Button onClick={onStartNew}>Create Another</Button>
          ) : (
            <Button asChild>
              <Link href="/quotes/create">Create Another</Link>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceLink({
  label,
  id,
  href,
}: {
  label: string;
  id: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="font-mono text-sm">{id}</span>
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80"
        >
          <ExternalLink className="size-4" />
        </a>
      ) : (
        <Badge variant="outline" className="text-xs">
          Local
        </Badge>
      )}
    </div>
  );
}
```

## `quotes/create/steps/review-quote.tsx`

```tsx
"use client";

import { useState } from "react";
import { Loader2, FlaskConical, Rocket, ArrowDown, ArrowUp, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DryRunLogPanel } from "@/components/ui/dry-run-log-panel";
import { formatCurrency } from "@/lib/format";
import {
  createQuoteDraft,
  type CreateQuoteResult,
} from "@/lib/actions/quotes";
import {
  CONTRACT_TERM_LABELS,
  BILLING_FREQUENCY_LABELS,
  computeIterations,
  computeContractEndDate,
  convertPriceToFrequency,
  formatBillingCycleSummary,
  billingFrequencyIntervalLabel,
} from "@/lib/billing-utils";
import type { QuoteWizardState } from "../wizard";

interface Props {
  state: QuoteWizardState;
  onBack: () => void;
  onResult: (result: CreateQuoteResult) => void;
  onToggleDryRun: (v: boolean) => void;
}

export function ReviewQuote({ state, onBack, onResult, onToggleDryRun }: Props) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dryRunLog, setDryRunLog] = useState<string[] | null>(null);

  const [productWarnings, setProductWarnings] = useState<string[]>([]);

  const freqLabel = billingFrequencyIntervalLabel(state.billingFrequency);

  function effectiveUnit(li: (typeof state.lineItems)[number]): number {
    return li.overrideUnitAmount ?? li.unitAmount;
  }

  const isOneTime = (interval: string) =>
    !interval || interval === "one-time" || interval === "one_time";

  function toDisplay(amount: number, interval: string): number {
    if (isOneTime(interval)) return amount;
    return convertPriceToFrequency(amount, interval, state.billingFrequency);
  }

  const total = state.lineItems.reduce(
    (acc, li) => acc + toDisplay(effectiveUnit(li), li.interval) * li.quantity,
    0,
  );

  const standardTotal = state.lineItems.reduce(
    (acc, li) => acc + toDisplay(li.unitAmount, li.interval) * li.quantity,
    0,
  );

  const totalDelta = total - standardTotal;

  async function handleCreate() {
    if (!state.customer?.stripeCustomerId) return;
    setIsExecuting(true);
    setError(null);
    setDryRunLog(null);

    try {
      const result = await createQuoteDraft({
        stripeCustomerId: state.customer.stripeCustomerId,
        customerName: state.customer.sfAccountName ?? "Unknown",
        sfAccountId: state.customer.sfAccountId ?? undefined,
        opportunityId: state.opportunityId || undefined,
        billToContactId: state.billToContactId || undefined,
        lineItems: state.lineItems,
        contractTerm: state.contractTerm,
        billingFrequency: state.billingFrequency,
        collectionMethod: state.collectionMethod,
        daysUntilDue:
          state.collectionMethod === "send_invoice"
            ? (Number.isNaN(parseInt(state.daysUntilDue, 10))
                ? 30
                : parseInt(state.daysUntilDue, 10))
            : undefined,
        effectiveDate: state.effectiveDate || undefined,
        trialPeriodDays: state.trialPeriodDays
          ? parseInt(state.trialPeriodDays, 10)
          : undefined,
        expiresInDays: parseInt(state.expiresInDays, 10) || 30,
        idempotencyKey: state.idempotencyKey,
        dryRun: state.dryRun,
      });

      if (!result.success) {
        setError(result.error ?? "Unknown error");
        setIsExecuting(false);
        return;
      }

      if (result.productValidation && !result.productValidation.valid) {
        setProductWarnings(result.productValidation.missingProducts);
      }

      if (result.dryRun && result.dryRunLog) {
        setDryRunLog(result.dryRunLog);
        setIsExecuting(false);
        return;
      }

      onResult(result);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred",
      );
      setIsExecuting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <CardTitle>Review &amp; Create Quote</CardTitle>
        <CardDescription>
          Verify everything below, then create the Stripe quote.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <div className="flex items-center justify-between rounded-lg border px-4 py-3">
          <div className="flex items-center gap-3">
            {state.dryRun ? (
              <FlaskConical className="size-5 text-amber-500" />
            ) : (
              <Rocket className="size-5 text-green-500" />
            )}
            <div>
              <Label htmlFor="dry-run-toggle" className="text-sm font-medium">
                {state.dryRun ? "Dry Run Mode" : "Live Mode"}
              </Label>
              <p className="text-xs text-muted-foreground">
                {state.dryRun
                  ? "No Stripe/SF changes — logs what would happen"
                  : "Will create Stripe draft quote & SF mirror"}
              </p>
            </div>
          </div>
          <Switch
            id="dry-run-toggle"
            checked={state.dryRun}
            onCheckedChange={onToggleDryRun}
          />
        </div>

        <Section title="Customer">
          <Row
            label="Account"
            value={state.customer?.sfAccountName ?? "---"}
          />
          <Row
            label="Stripe ID"
            value={state.customer?.stripeCustomerId ?? "---"}
            mono
          />
          {state.customer?.sfAccountId && (
            <Row label="SF Account" value={state.customer.sfAccountId} mono />
          )}
          {state.opportunityId && (
            <Row label="Opportunity" value={state.opportunityId} mono />
          )}
        </Section>

        <Separator />

        <Section title="Line Items">
          {state.lineItems.map((li, idx) => {
            const isOverridden = li.overrideUnitAmount != null && li.overrideUnitAmount !== li.unitAmount;
            const isDiscount = isOverridden && li.overrideUnitAmount! < li.unitAmount;
            const isPremium = isOverridden && li.overrideUnitAmount! > li.unitAmount;
            const eff = effectiveUnit(li);

            return (
              <div key={idx} className="flex flex-col gap-1">
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
                  <div className="flex items-center gap-3 text-sm">
                    <Badge variant="outline">x{li.quantity}</Badge>
                    {isOverridden ? (
                      <span className="flex items-center gap-1.5 tabular-nums">
                        <span className="text-muted-foreground line-through">
                          {formatCurrency(toDisplay(li.unitAmount, li.interval), li.currency)}
                        </span>
                        <span className={`font-medium ${isDiscount ? "text-green-700" : "text-amber-700"}`}>
                          {formatCurrency(toDisplay(eff, li.interval), li.currency)}
                        </span>
                        <span className="text-muted-foreground">
                          {isOneTime(li.interval) ? " one-time" : `/${freqLabel}`}
                        </span>
                      </span>
                    ) : (
                      <span className="font-medium tabular-nums">
                        {formatCurrency(toDisplay(li.unitAmount, li.interval), li.currency)}
                        {isOneTime(li.interval) ? " one-time" : `/${freqLabel}`}
                      </span>
                    )}
                  </div>
                </div>
                {isOverridden && (
                  <div className="flex items-center justify-end gap-2">
                    {isDiscount ? (
                      <Badge variant="secondary" className="gap-1 text-xs text-green-700">
                        <ArrowDown className="size-3" />
                        Discount
                      </Badge>
                    ) : isPremium ? (
                      <Badge variant="secondary" className="gap-1 text-xs text-amber-700">
                        <ArrowUp className="size-3" />
                        Premium
                      </Badge>
                    ) : null}
                    <span className={`font-mono text-xs ${isDiscount ? "text-green-600" : "text-amber-600"}`}>
                      = {formatCurrency(toDisplay(eff, li.interval) * li.quantity, li.currency)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          <Separator />
          {totalDelta !== 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Standard total</span>
              <span className="tabular-nums text-muted-foreground">
                {formatCurrency(standardTotal, state.lineItems[0]?.currency ?? "usd")}
              </span>
            </div>
          )}
          {totalDelta < 0 && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-green-700">Total Discount</span>
                <span className="font-medium tabular-nums text-green-700">
                  {formatCurrency(totalDelta, state.lineItems[0]?.currency ?? "usd")}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-green-600">Savings</span>
                <span className="text-green-600">
                  {Math.round((Math.abs(totalDelta) / standardTotal) * 100)}% off
                </span>
              </div>
            </>
          )}
          {totalDelta > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium text-amber-700">Premium</span>
              <span className="font-medium tabular-nums text-amber-700">
                +{formatCurrency(totalDelta, state.lineItems[0]?.currency ?? "usd")}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              Total{" "}
              <span className="text-xs font-normal text-muted-foreground">
                /{freqLabel}
              </span>
            </span>
            <span className="text-sm font-bold tabular-nums">
              {formatCurrency(total, state.lineItems[0]?.currency ?? "usd")}
            </span>
          </div>
        </Section>

        <Separator />

        <Section title="Payment Path">
          <Row
            label="Method"
            value={
              state.collectionMethod === "charge_automatically"
                ? "Prepay (charge automatically)"
                : "Invoice (send invoice)"
            }
          />
          {state.collectionMethod === "send_invoice" && (
            <Row
              label="Payment terms"
              value={
                state.daysUntilDue === "0"
                  ? "Due on receipt"
                  : `Net ${state.daysUntilDue} days`
              }
            />
          )}
        </Section>

        <Separator />

        <Section title="Contract &amp; Billing">
          <Row
            label="Contract term"
            value={CONTRACT_TERM_LABELS[state.contractTerm]}
          />
          <Row
            label="Billing frequency"
            value={BILLING_FREQUENCY_LABELS[state.billingFrequency]}
          />
          <Row
            label="Billing cycles"
            value={String(computeIterations(state.contractTerm, state.billingFrequency))}
          />
          <Row
            label="Contract end"
            value={computeContractEndDate(
              state.effectiveDate ? new Date(state.effectiveDate) : new Date(),
              state.contractTerm,
            ).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          />
          <Row label="Auto-renew" value="Yes" />
          {(() => {
            const recurringItems = state.lineItems.filter(
              (li) => li.interval && li.interval !== "one-time" && li.interval !== "one_time",
            );
            if (recurringItems.length === 0) return null;
            const perCycle = recurringItems.reduce((acc, li) => {
              const eff = li.overrideUnitAmount ?? li.unitAmount;
              return acc + convertPriceToFrequency(eff, li.interval, state.billingFrequency) * li.quantity;
            }, 0);
            return (
              <Row
                label={`Per ${BILLING_FREQUENCY_LABELS[state.billingFrequency].toLowerCase()} cycle`}
                value={formatCurrency(perCycle, state.lineItems[0]?.currency ?? "usd")}
              />
            );
          })()}
          <div className="mt-1 rounded border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
            {formatBillingCycleSummary(state.contractTerm, state.billingFrequency)}
          </div>
        </Section>

        <Separator />

        <Section title="Dates">
          <Row
            label="Effective date"
            value={state.effectiveDate || "Immediate on acceptance"}
          />
          {state.trialPeriodDays && (
            <Row label="Trial period" value={`${state.trialPeriodDays} days`} />
          )}
          <Row
            label="Quote expires in"
            value={`${state.expiresInDays} days`}
          />
        </Section>

        <Separator />

        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Idempotency key:{" "}
            <code className="font-mono">{state.idempotencyKey}</code>
          </p>
        </div>

        {dryRunLog && dryRunLog.length > 0 && (
          <DryRunLogPanel logs={dryRunLog} />
        )}

        {productWarnings.length > 0 && (
          <div className="flex gap-3 rounded-md border border-amber-500/50 bg-amber-50/50 px-4 py-3 dark:bg-amber-950/20">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
                Missing Salesforce Product Mapping
              </span>
              <ul className="text-xs text-amber-600 dark:text-amber-300">
                {productWarnings.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
              <span className="text-xs text-amber-600/80">
                These products won&apos;t appear on the SF quote line items.
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

      </CardContent>
      <CardFooter className="justify-between border-t">
        <Button variant="outline" onClick={onBack} disabled={isExecuting}>
          Back
        </Button>
        <Button onClick={handleCreate} disabled={isExecuting}>
          {isExecuting ? (
            <>
              <Loader2 className="animate-spin" />
              {state.dryRun ? "Running Dry Run..." : "Creating Quote..."}
            </>
          ) : state.dryRun ? (
            <>
              <FlaskConical className="size-4" />
              Run Dry Test
            </>
          ) : (
            "Create Draft Quote"
          )}
        </Button>
      </CardFooter>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>
        {value}
      </span>
    </div>
  );
}
```

## `quotes/create/wizard.tsx`

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { Check } from "lucide-react";
import { PickCustomer } from "./steps/pick-customer";
import { ConfigureQuote } from "./steps/configure-quote";
import { ConfigureCoTerm } from "../co-term/configure-co-term";
import { ReviewQuote } from "./steps/review-quote";
import { ReviewCoTerm } from "../co-term/review-co-term";
import { DocumentPreview } from "./steps/document-preview";
import { QuoteSuccess } from "./steps/quote-success";
import { cancelQuote } from "@/lib/actions/quotes";
import type { QuoteLineItem, CreateQuoteResult } from "@/lib/actions/quotes";
import type { CustomerSubscription } from "@/lib/queries/customer-subscriptions";
import type { ExistingSubItem } from "@/lib/actions/co-term-quote";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";
import type { EffectiveTiming } from "./steps/pick-timing";

export type QuoteType = "New" | "Expansion" | "Renewal" | "Amendment";
export type ContractMode = "new_contract" | "co_term";

const STEP_LABELS = [
  "Customer",
  "Configure",
  "Review",
  "Preview",
] as const;

const STORAGE_KEY = "quote-wizard-session";

export interface QuoteCustomer {
  id: string;
  sfAccountId: string | null;
  sfAccountName: string | null;
  stripeCustomerId: string | null;
  domain: string | null;
}

export interface QuoteWizardState {
  customer: QuoteCustomer | null;
  opportunityId: string;
  billToContactId: string;
  contractMode: ContractMode;
  lineItems: QuoteLineItem[];
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  effectiveDate: string;
  trialPeriodDays: string;
  expiresInDays: string;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue: string;
  idempotencyKey: string;
  dryRun: boolean;
  // Co-term specific fields (only used when contractMode === "co_term")
  selectedSubscription: CustomerSubscription | null;
  existingItems: ExistingSubItem[];
  effectiveTiming: EffectiveTiming;
}

interface PersistedSession {
  step: number;
  state: QuoteWizardState;
  result: CreateQuoteResult | null;
  docSent: boolean;
}

function generateIdempotencyKey() {
  return `cqt_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function loadSessionByKey(key: string): PersistedSession | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

function saveSessionByKey(key: string, session: PersistedSession) {
  try {
    sessionStorage.setItem(key, JSON.stringify(session));
  } catch { /* storage full or unavailable */ }
}

function clearSessionByKey(key: string) {
  try {
    sessionStorage.removeItem(key);
  } catch { /* noop */ }
}

const DEFAULT_STATE: QuoteWizardState = {
  customer: null,
  opportunityId: "",
  billToContactId: "",
  contractMode: "new_contract",
  lineItems: [],
  contractTerm: "1yr",
  billingFrequency: "monthly",
  effectiveDate: "",
  trialPeriodDays: "",
  expiresInDays: "30",
  collectionMethod: "charge_automatically",
  daysUntilDue: "30",
  idempotencyKey: generateIdempotencyKey(),
  dryRun: true,
  selectedSubscription: null,
  existingItems: [],
  effectiveTiming: "immediate",
};

function deriveBillingFrequency(sub: CustomerSubscription): BillingFrequency {
  const interval = sub.billingInterval;
  const count = sub.billingIntervalCount;
  if (interval === "month") {
    if (count === 1) return "monthly";
    if (count === 3) return "quarterly";
    if (count === 6) return "semi_annual";
  }
  if (interval === "year") {
    if (count === 1) return "annual";
    if (count === 2) return "2yr";
    if (count === 3) return "3yr";
  }
  return "monthly";
}

export interface QuoteWizardProps {
  quoteType?: QuoteType;
  initialState?: Partial<QuoteWizardState>;
  initialStep?: number;
  storageKey?: string;
  badge?: React.ReactNode;
}

export function QuoteWizard({
  quoteType = "New",
  initialState,
  initialStep = 0,
  storageKey = STORAGE_KEY,
  badge,
}: QuoteWizardProps = {}) {
  const mergedDefault: QuoteWizardState = initialState
    ? { ...DEFAULT_STATE, ...initialState, idempotencyKey: generateIdempotencyKey() }
    : DEFAULT_STATE;

  const [step, setStep] = useState(initialStep);
  const [result, setResult] = useState<CreateQuoteResult | null>(null);
  const [docSent, setDocSent] = useState(false);
  const [state, setState] = useState<QuoteWizardState>(mergedDefault);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = loadSessionByKey(storageKey);
    if (saved) {
      setStep(saved.step);
      setResult(saved.result);
      setDocSent(saved.docSent);
      setState(saved.state);
    }
    setHydrated(true);
  }, [storageKey]);

  useEffect(() => {
    if (!hydrated) return;
    saveSessionByKey(storageKey, { step, state, result, docSent });
  }, [step, state, result, docSent, hydrated, storageKey]);

  const update = useCallback(
    <K extends keyof QuoteWizardState>(key: K, value: QuoteWizardState[K]) => {
      setState((prev) => ({
        ...prev,
        [key]: value,
        idempotencyKey: key === "dryRun" ? prev.idempotencyKey : generateIdempotencyKey(),
      }));
    },
    [],
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, STEP_LABELS.length - 1)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  const isCoTerm = state.contractMode === "co_term";

  function handleSubscriptionSelect(sub: CustomerSubscription) {
    const existing: ExistingSubItem[] = sub.items.map((item) => ({
      subscriptionItemId: item.id,
      priceId: item.priceId,
      productName: item.productName,
      quantity: item.quantity,
      unitAmount: item.unitAmount,
      interval: item.interval,
      intervalCount: item.intervalCount,
    }));

    setState((prev) => ({
      ...prev,
      selectedSubscription: sub,
      existingItems: existing,
      billingFrequency: deriveBillingFrequency(sub),
      collectionMethod: sub.collectionMethod as "charge_automatically" | "send_invoice",
      idempotencyKey: generateIdempotencyKey(),
    }));
  }

  function handleQuoteResult(r: CreateQuoteResult) {
    setResult(r);
    setStep(3);
  }

  function handleDocSent() {
    setDocSent(true);
    clearSessionByKey(storageKey);
  }

  function handleStartNew() {
    clearSessionByKey(storageKey);
    setStep(initialStep);
    setResult(null);
    setDocSent(false);
    setState({ ...mergedDefault, idempotencyKey: generateIdempotencyKey() });
  }

  if (docSent && result?.success) {
    return <QuoteSuccess result={result} state={state} onStartNew={handleStartNew} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {badge}
            <span className="text-xs font-medium text-muted-foreground">
              Step {step + 1} of {STEP_LABELS.length}
            </span>
          </div>
          {step > 0 && (
            <button
              type="button"
              onClick={handleStartNew}
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Start over
            </button>
          )}
        </div>
        <nav aria-label="Wizard progress" className="flex items-center">
          {STEP_LABELS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center">
              <button
                type="button"
                onClick={() => i < step && setStep(i)}
                disabled={i >= step}
                className="flex items-center gap-2"
              >
                <span
                  className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    i === step
                      ? "bg-primary text-primary-foreground"
                      : i < step
                        ? "bg-primary/10 text-primary cursor-pointer"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {i < step ? <Check className="size-3.5" /> : i + 1}
                </span>
                <span
                  className={`hidden text-xs font-medium sm:inline ${
                    i === step
                      ? "text-foreground"
                      : i < step
                        ? "text-primary cursor-pointer"
                        : "text-muted-foreground"
                  }`}
                >
                  {label}
                </span>
              </button>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`mx-3 h-px flex-1 ${
                    i < step ? "bg-primary/30" : "bg-border"
                  }`}
                />
              )}
            </div>
          ))}
        </nav>
      </div>

      {step === 0 && (
        <PickCustomer
          quoteType={quoteType}
          selected={state.customer}
          opportunityId={state.opportunityId}
          billToContactId={state.billToContactId}
          contractMode={state.contractMode}
          onSelect={(c) => update("customer", c as QuoteWizardState["customer"])}
          onOpportunityChange={(v) => update("opportunityId", v)}
          onBillToContactChange={(v) => update("billToContactId", v)}
          onContractModeChange={(v) => update("contractMode", v)}
          onNext={next}
        />
      )}
      {step === 1 && !isCoTerm && (
        <ConfigureQuote
          contractTerm={state.contractTerm}
          billingFrequency={state.billingFrequency}
          effectiveDate={state.effectiveDate}
          trialPeriodDays={state.trialPeriodDays}
          expiresInDays={state.expiresInDays}
          lineItems={state.lineItems}
          collectionMethod={state.collectionMethod}
          daysUntilDue={state.daysUntilDue}
          onChangeContractTerm={(v) => update("contractTerm", v)}
          onChangeBillingFrequency={(v) => update("billingFrequency", v)}
          onChangeEffectiveDate={(v) => update("effectiveDate", v)}
          onChangeTrialDays={(v) => update("trialPeriodDays", v)}
          onChangeExpiresIn={(v) => update("expiresInDays", v)}
          onChangeLineItems={(items) => update("lineItems", items)}
          onChangeMethod={(v) => update("collectionMethod", v)}
          onChangeDays={(v) => update("daysUntilDue", v)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 1 && isCoTerm && state.customer?.stripeCustomerId && (
        <ConfigureCoTerm
          stripeCustomerId={state.customer.stripeCustomerId}
          selectedSubscription={state.selectedSubscription}
          lineItems={state.lineItems}
          contractTerm={state.contractTerm}
          billingFrequency={state.billingFrequency}
          timing={state.effectiveTiming}
          onSelectSubscription={handleSubscriptionSelect}
          onChangeContractTerm={(v) => update("contractTerm", v)}
          onChangeBillingFrequency={(v) => update("billingFrequency", v)}
          onChangeLineItems={(items) => update("lineItems", items)}
          onChangeTiming={(t) => update("effectiveTiming", t)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && !isCoTerm && (
        <ReviewQuote
          state={state}
          onBack={back}
          onResult={handleQuoteResult}
          onToggleDryRun={(v) => update("dryRun", v)}
        />
      )}
      {step === 2 && isCoTerm && (
        <ReviewCoTerm
          state={{
            customer: state.customer as any,
            opportunityId: state.opportunityId,
            billToContactId: state.billToContactId,
            selectedSubscription: state.selectedSubscription,
            existingItems: state.existingItems,
            lineItems: state.lineItems,
            contractTerm: state.contractTerm,
            billingFrequency: state.billingFrequency,
            effectiveTiming: state.effectiveTiming,
            collectionMethod: state.collectionMethod,
            daysUntilDue: state.daysUntilDue,
            expiresInDays: state.expiresInDays,
            idempotencyKey: state.idempotencyKey,
            dryRun: state.dryRun,
          }}
          onBack={back}
          onResult={handleQuoteResult}
          onToggleDryRun={(v) => update("dryRun", v)}
        />
      )}
      {step === 3 && result && (
        <DocumentPreview
          result={result}
          onSent={handleDocSent}
          onBack={async () => {
            if (result.quoteRecordId && !result.dryRun) {
              await cancelQuote(result.quoteRecordId);
            }
            setResult(null);
            setState((prev) => ({ ...prev, idempotencyKey: generateIdempotencyKey() }));
            setStep(2);
          }}
        />
      )}
    </div>
  );
}
```

## `quotes/loading.tsx`

```tsx
export default function Loading() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <div className="animate-pulse rounded bg-muted h-7 w-48" />
        <div className="animate-pulse rounded bg-muted h-4 w-72" />
      </div>
      <div className="animate-pulse rounded bg-muted h-10 w-full" />
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="animate-pulse rounded bg-muted h-12 w-full" />
        ))}
      </div>
    </div>
  );
}
```

## `quotes/page.tsx`

```tsx
import { getMyQuotes, type QuoteRow } from "@/lib/queries/quotes";
import { QuoteListTable } from "./quote-list-table";

export default async function QuotesPage() {
  let quotes: QuoteRow[] = [];
  let error: string | null = null;

  try {
    quotes = await getMyQuotes();
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load quotes.";
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Quotes</h1>
        <p className="text-sm text-muted-foreground">
          Stripe quotes you&apos;ve created. Track status and send acceptance
          links to customers.
        </p>
      </div>

      {error ? (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      ) : (
        <QuoteListTable quotes={quotes} />
      )}
    </div>
  );
}
```

## `quotes/quote-list-table.tsx`

```tsx
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ExternalLink,
  Copy,
  Check,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Plus,
} from "lucide-react";
import type { QuoteRow } from "@/lib/queries/quotes";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency, formatDate, quoteStatusVariant } from "@/lib/format";

const ALL = "__all__";

function HealthBadge({ q }: { q: QuoteRow }) {
  const isAccepted = q.status === "accepted";
  const isDraft = q.status === "draft" || q.status === "dry_run";

  const hasSf = !!q.sfQuoteId;
  const hasDocuSign = !!q.docusignEnvelopeId;
  const hasSub = !!q.stripeSubscriptionId;

  let errors = 0;
  let warnings = 0;

  if (!hasSf) {
    if (!isDraft) errors++;
    else warnings++;
  }
  if (!hasDocuSign && !isDraft) warnings++;
  if (isAccepted && !hasSub) errors++;

  if (errors > 0) {
    return (
      <Badge variant="destructive" className="gap-1 text-[10px]">
        <XCircle className="size-3" />
        {errors} issue{errors > 1 ? "s" : ""}
      </Badge>
    );
  }
  if (warnings > 0) {
    return (
      <Badge variant="warning" className="gap-1 text-[10px]">
        <AlertCircle className="size-3" />
        {warnings} warn
      </Badge>
    );
  }
  if (isDraft) {
    return (
      <Badge variant="secondary" className="gap-1 text-[10px]">
        <Clock className="size-3" />
        Draft
      </Badge>
    );
  }
  return (
    <Badge variant="success" className="gap-1 text-[10px]">
      <CheckCircle2 className="size-3" />
      OK
    </Badge>
  );
}

function SyncBadges({ q }: { q: QuoteRow }) {
  return (
    <div className="flex items-center gap-1">
      <Badge
        variant={q.sfQuoteId ? "info" : "secondary"}
        className="text-[10px]"
        title={q.sfQuoteId ? `SF: ${q.sfQuoteId}` : "No SF mirror"}
      >
        SF
      </Badge>
      <Badge
        variant={q.docusignEnvelopeId ? "default" : "secondary"}
        className="text-[10px]"
        title={q.docusignEnvelopeId ? `DS: ${q.docusignEnvelopeId}` : "No DocuSign"}
      >
        DS
      </Badge>
      <Badge
        variant={q.stripeSubscriptionId ? "success" : "secondary"}
        className="text-[10px]"
        title={
          q.stripeSubscriptionId
            ? `Sub: ${q.stripeSubscriptionId}`
            : "No subscription"
        }
      >
        Sub
      </Badge>
    </div>
  );
}

export function QuoteListTable({ quotes }: { quotes: QuoteRow[] }) {
  const [statusFilter, setStatusFilter] = useState(ALL);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const statuses = useMemo(() => {
    const set = new Set<string>();
    for (const q of quotes) set.add(q.status);
    return Array.from(set).sort();
  }, [quotes]);

  const filtered = useMemo(
    () =>
      statusFilter === ALL
        ? quotes
        : quotes.filter((q) => q.status === statusFilter),
    [quotes, statusFilter],
  );

  function copyAcceptLink(acceptToken: string, rowId: string) {
    const url = `${window.location.origin}/accept/${acceptToken}`;
    navigator.clipboard.writeText(url);
    setCopiedId(rowId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <Card>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <CardTitle>Quotes</CardTitle>
            <CardDescription>
              {statusFilter !== ALL
                ? `${filtered.length} of ${quotes.length} quotes — ${statusFilter}`
                : `${quotes.length} quote${quotes.length !== 1 ? "s" : ""}`}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger size="sm" className="w-[140px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild size="sm">
              <Link href="/quotes/create">
                <Plus className="size-3.5" />
                Create
              </Link>
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {filtered.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-muted-foreground">
            {quotes.length === 0
              ? "No quotes yet. Create your first quote to get started."
              : "No quotes match the selected filter."}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sync</TableHead>
                <TableHead>Health</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((q) => (
                <TableRow key={q.id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/quotes/${q.id}`}
                      className="hover:underline"
                    >
                      {q.customerName}
                    </Link>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {q.totalAmount !== null
                      ? formatCurrency(q.totalAmount, q.currency)
                      : "---"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-[10px]">
                      {q.collectionMethod === "charge_automatically"
                        ? "Prepay"
                        : "Invoice"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant={quoteStatusVariant(q.status)} className="text-[10px] capitalize">
                      {q.status.replace(/_/g, " ")}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <SyncBadges q={q} />
                  </TableCell>
                  <TableCell>
                    <HealthBadge q={q} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(q.createdAt)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Link
                        href={`/quotes/${q.id}`}
                        title="View details"
                        className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" />
                      </Link>
                      {(q.status === "open" || q.status === "dry_run") && (
                        <button
                          type="button"
                          onClick={() => copyAcceptLink(q.acceptToken, q.id)}
                          title="Copy accept link"
                          className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground"
                        >
                          {copiedId === q.id ? (
                            <Check className="size-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="size-3.5" />
                          )}
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

## `subscriptions/cancellation/page.tsx`

```tsx
import { XCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function CancellationPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Cancellation</h1>
        <p className="text-sm text-muted-foreground">
          Cancel an active subscription immediately or at period end.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <XCircle className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">Coming Soon</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Look up a customer's active subscriptions, choose immediate or end-of-period cancellation, handle prorations, and log the action.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## `subscriptions/create/page.tsx`

```tsx
import { Wizard } from "./wizard";

export default function CreateSubscriptionPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Create Subscription</h1>
        <p className="text-sm text-muted-foreground">
          Set up a new Stripe subscription schedule for a customer.
        </p>
      </div>
      <Wizard />
    </div>
  );
}
```

## `subscriptions/create/steps/pick-billing.tsx`

```tsx
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
```

## `subscriptions/create/steps/pick-customer.tsx`

```tsx
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
```

## `subscriptions/create/steps/pick-dates.tsx`

```tsx
"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  startDate: string;
  endDate: string;
  onChangeStart: (v: string) => void;
  onChangeEnd: (v: string) => void;
  onNext: () => void;
  onBack: () => void;
}

export function PickDates({
  startDate,
  endDate,
  onChangeStart,
  onChangeEnd,
  onNext,
  onBack,
}: Props) {
  const isValid = startDate && endDate && new Date(endDate) > new Date(startDate);

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Subscription Period</h2>
          <p className="text-sm text-muted-foreground">
            Choose start and end dates. Past dates are allowed for backdated subscriptions.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="start-date">Start Date &amp; Time</Label>
            <Input
              id="start-date"
              type="datetime-local"
              value={startDate}
              onChange={(e) => onChangeStart(e.target.value)}
            />
            {startDate && new Date(startDate) < new Date() && (
              <p className="text-xs text-amber-600">
                This is in the past — a backdated subscription will be created.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="end-date">End Date &amp; Time</Label>
            <Input
              id="end-date"
              type="datetime-local"
              value={endDate}
              onChange={(e) => onChangeEnd(e.target.value)}
              min={startDate || undefined}
            />
            {startDate && endDate && new Date(endDate) <= new Date(startDate) && (
              <p className="text-xs text-destructive">
                End date must be after the start date.
              </p>
            )}
          </div>
        </div>

        {startDate && endDate && isValid && (
          <div className="rounded-lg border bg-muted/50 px-4 py-3">
            <p className="text-sm">
              <span className="font-medium">Duration:</span>{" "}
              {formatDuration(new Date(startDate), new Date(endDate))}
            </p>
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

function formatDuration(start: Date, end: Date) {
  const diffMs = end.getTime() - start.getTime();
  const days = Math.floor(diffMs / 86_400_000);
  if (days < 31) return `${days} day${days !== 1 ? "s" : ""}`;
  const months = Math.round(days / 30.44);
  if (months < 12) return `~${months} month${months !== 1 ? "s" : ""}`;
  const years = Math.round(months / 12);
  const remainingMonths = months % 12;
  if (remainingMonths === 0) return `${years} year${years !== 1 ? "s" : ""}`;
  return `${years}y ${remainingMonths}m`;
}
```

## `subscriptions/create/steps/pick-prices.tsx`

```tsx
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
```

## `subscriptions/create/steps/review.tsx`

```tsx
"use client";

import { useState } from "react";
import { Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import {
  executeCreateSubscription,
  type CreateSubscriptionResult,
} from "@/lib/actions/create-subscription";
import type { WizardState } from "../wizard";

interface Props {
  state: WizardState;
  onBack: () => void;
  onResult: (result: CreateSubscriptionResult) => void;
}

export function Review({ state, onBack, onResult }: Props) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalMonthly = state.lineItems.reduce(
    (acc, li) => acc + li.unitAmount * li.quantity,
    0,
  );

  async function handleExecute() {
    if (!state.customer?.stripeCustomerId) return;
    setIsExecuting(true);
    setError(null);

    try {
      const result = await executeCreateSubscription({
        customerId: state.customer.id,
        stripeCustomerId: state.customer.stripeCustomerId,
        customerName: state.customer.sfAccountName ?? "Unknown",
        lineItems: state.lineItems,
        startDate: state.startDate,
        endDate: state.endDate,
        billingMode: state.billingMode,
        billingDate: state.billingMode === "future" ? state.billingDate : undefined,
        idempotencyKey: state.idempotencyKey,
      });

      if (!result.success) {
        setError(result.error ?? "Unknown error");
        setIsExecuting(false);
        return;
      }

      onResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
      setIsExecuting(false);
    }
  }

  const start = new Date(state.startDate);
  const end = new Date(state.endDate);

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 pt-6">
        <div>
          <h2 className="text-lg font-semibold">Review &amp; Confirm</h2>
          <p className="text-sm text-muted-foreground">
            Verify everything below, then execute to create the subscription.
          </p>
        </div>

        {/* Customer */}
        <Section title="Customer">
          <Row label="Account" value={state.customer?.sfAccountName ?? "—"} />
          <Row label="Stripe ID" value={state.customer?.stripeCustomerId ?? "—"} mono />
          <Row label="Domain" value={state.customer?.domain ?? "—"} />
        </Section>

        <Separator />

        {/* Line items */}
        <Section title="Prices">
          {state.lineItems.map((li) => (
            <div key={li.priceId} className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{li.nickname}</span>
                <span className="text-xs text-muted-foreground font-mono">{li.priceId}</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Badge variant="outline">x{li.quantity}</Badge>
                <span className="font-medium tabular-nums">
                  {formatCurrency(li.unitAmount * li.quantity, li.currency)}/{li.interval}
                </span>
              </div>
            </div>
          ))}
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total recurring</span>
            <span className="text-sm font-bold tabular-nums">
              {formatCurrency(totalMonthly, state.lineItems[0]?.currency ?? "usd")}/
              {state.lineItems[0]?.interval ?? "month"}
            </span>
          </div>
        </Section>

        <Separator />

        {/* Dates */}
        <Section title="Period">
          <Row label="Start" value={formatDT(start)} />
          <Row label="End" value={formatDT(end)} />
          {start < new Date() && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600">
              <AlertTriangle className="size-3" />
              Backdated — start date is in the past.
            </div>
          )}
        </Section>

        <Separator />

        {/* Billing */}
        <Section title="Billing">
          {state.billingMode === "now" ? (
            <Row label="Invoice timing" value="Bill immediately on start" />
          ) : (
            <>
              <Row label="Invoice timing" value="Deferred billing" />
              <Row label="First invoice date" value={formatDT(new Date(state.billingDate))} />
            </>
          )}
        </Section>

        <Separator />

        {/* Idempotency */}
        <div className="rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-xs text-muted-foreground">
            Idempotency key:{" "}
            <code className="font-mono">{state.idempotencyKey}</code>
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Safe to retry — duplicate submissions will return the same result.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={onBack} disabled={isExecuting}>
            Back
          </Button>
          <Button onClick={handleExecute} disabled={isExecuting}>
            {isExecuting ? (
              <>
                <Loader2 className="animate-spin" />
                Creating…
              </>
            ) : (
              "Execute"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Row({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-xs" : "font-medium"}>{value}</span>
    </div>
  );
}

function formatDT(d: Date) {
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
```

## `subscriptions/create/steps/success.tsx`

```tsx
"use client";

import Link from "next/link";
import { CheckCircle2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/format";
import type { CreateSubscriptionResult } from "@/lib/actions/create-subscription";
import type { WizardState } from "../wizard";

interface Props {
  result: CreateSubscriptionResult;
  state: WizardState;
}

export function Success({ result, state }: Props) {
  const isMock = result.stripeScheduleId?.includes("mock") ?? false;
  const dashboardBase = "https://dashboard.stripe.com";

  const totalRecurring = state.lineItems.reduce(
    (acc, li) => acc + li.unitAmount * li.quantity,
    0,
  );

  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-6 pt-8 pb-8">
        <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle2 className="size-8" />
        </div>

        <div className="text-center">
          <h2 className="text-xl font-bold tracking-tight">
            Subscription Created
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {state.customer?.sfAccountName} — {state.lineItems.length} line item
            {state.lineItems.length !== 1 ? "s" : ""} totaling{" "}
            {formatCurrency(totalRecurring, state.lineItems[0]?.currency ?? "usd")}/
            {state.lineItems[0]?.interval ?? "month"}
          </p>
        </div>

        {isMock && (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200">
            Mock mode — no real Stripe objects were created.
          </div>
        )}

        <div className="w-full max-w-md space-y-3">
          {result.stripeScheduleId && (
            <ResourceLink
              label="Subscription Schedule"
              id={result.stripeScheduleId}
              href={
                isMock
                  ? undefined
                  : `${dashboardBase}/subscription_schedules/${result.stripeScheduleId}`
              }
            />
          )}
          {result.stripeSubscriptionId && (
            <ResourceLink
              label="Subscription"
              id={result.stripeSubscriptionId}
              href={
                isMock
                  ? undefined
                  : `${dashboardBase}/subscriptions/${result.stripeSubscriptionId}`
              }
            />
          )}
          {result.workItemId && (
            <ResourceLink label="Work Item" id={result.workItemId} />
          )}
          {result.auditLogId && (
            <ResourceLink label="Audit Log" id={result.auditLogId} />
          )}
        </div>

        <Separator />

        <div className="flex gap-3">
          <Button asChild variant="outline">
            <Link href={`/subscriptions/customers/${state.customer?.id}`}>
              View Customer
            </Link>
          </Button>
          <Button asChild>
            <Link href="/subscriptions/create">
              Create Another
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ResourceLink({
  label,
  id,
  href,
}: {
  label: string;
  id: string;
  href?: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border px-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-mono">{id}</span>
      </div>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:text-primary/80"
        >
          <ExternalLink className="size-4" />
        </a>
      ) : (
        <Badge variant="outline" className="text-xs">
          Local
        </Badge>
      )}
    </div>
  );
}
```

## `subscriptions/create/wizard.tsx`

```tsx
"use client";

import { useState, useCallback } from "react";
import { PickCustomer } from "./steps/pick-customer";
import { PickPrices } from "./steps/pick-prices";
import { PickDates } from "./steps/pick-dates";
import { PickBilling } from "./steps/pick-billing";
import { Review } from "./steps/review";
import { Success } from "./steps/success";
import type { LineItem, CreateSubscriptionResult } from "@/lib/actions/create-subscription";

const STEP_LABELS = [
  "Customer",
  "Prices",
  "Dates",
  "Billing",
  "Review",
] as const;

export interface WizardCustomer {
  id: string;
  sfAccountName: string | null;
  stripeCustomerId: string | null;
  domain: string | null;
}

export interface WizardState {
  customer: WizardCustomer | null;
  lineItems: LineItem[];
  startDate: string;
  endDate: string;
  billingMode: "now" | "future";
  billingDate: string;
  idempotencyKey: string;
}

function generateIdempotencyKey() {
  return `csub_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function Wizard() {
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<CreateSubscriptionResult | null>(null);

  const [state, setState] = useState<WizardState>({
    customer: null,
    lineItems: [],
    startDate: "",
    endDate: "",
    billingMode: "now",
    billingDate: "",
    idempotencyKey: generateIdempotencyKey(),
  });

  const update = useCallback(
    <K extends keyof WizardState>(key: K, value: WizardState[K]) => {
      setState((prev) => ({ ...prev, [key]: value }));
    },
    [],
  );

  const next = useCallback(() => setStep((s) => Math.min(s + 1, 4)), []);
  const back = useCallback(() => setStep((s) => Math.max(s - 1, 0)), []);

  if (result?.success) {
    return <Success result={result} state={state} />;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Step indicator */}
      <nav aria-label="Wizard progress" className="flex items-center gap-1">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            {i > 0 && (
              <div
                className={`mx-1 h-px w-6 ${i <= step ? "bg-foreground" : "bg-border"}`}
              />
            )}
            <button
              type="button"
              onClick={() => i < step && setStep(i)}
              disabled={i > step}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                i === step
                  ? "bg-primary text-primary-foreground"
                  : i < step
                    ? "bg-secondary text-secondary-foreground hover:bg-secondary/80 cursor-pointer"
                    : "bg-muted text-muted-foreground cursor-default"
              }`}
            >
              <span>{i + 1}</span>
              <span className="hidden sm:inline">{label}</span>
            </button>
          </div>
        ))}
      </nav>

      {/* Step content */}
      {step === 0 && (
        <PickCustomer
          selected={state.customer}
          onSelect={(c) => { update("customer", c); next(); }}
        />
      )}
      {step === 1 && (
        <PickPrices
          lineItems={state.lineItems}
          onChange={(items) => update("lineItems", items)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 2 && (
        <PickDates
          startDate={state.startDate}
          endDate={state.endDate}
          onChangeStart={(v) => update("startDate", v)}
          onChangeEnd={(v) => update("endDate", v)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 3 && (
        <PickBilling
          billingMode={state.billingMode}
          billingDate={state.billingDate}
          onChangeMode={(v) => update("billingMode", v)}
          onChangeDate={(v) => update("billingDate", v)}
          onNext={next}
          onBack={back}
        />
      )}
      {step === 4 && (
        <Review
          state={state}
          onBack={back}
          onResult={setResult}
        />
      )}
    </div>
  );
}
```

## `subscriptions/cross-sell/page.tsx`

```tsx
import { redirect } from "next/navigation";

export default function CrossSellPage() {
  redirect("/quotes/co-term");
}
```

## `subscriptions/customers/[id]/customer-tabs.tsx`

```tsx
// Re-export from shared location — this file can be deleted once all imports are updated.
export { CustomerTabs } from "@/components/customer/customer-tabs";
export type { WorkItemWithRelations, AuditLogWithActor } from "@/components/customer/customer-tabs";
```

## `subscriptions/customers/[id]/page.tsx`

```tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCustomerById, getCustomerWorkItems, getCustomerAuditLogs } from "@/lib/queries/customers";
import { getStripeDataForCustomer } from "@/lib/queries/stripe";
import { getSalesforceDataForCustomer } from "@/lib/queries/salesforce";
import { flags } from "@/lib/feature-flags";
import { CustomerTabs } from "@/components/customer/customer-tabs";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: Props) {
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const [stripeData, salesforceData, workItems, auditLogs] = await Promise.all([
    getStripeDataForCustomer(customer.stripeCustomerId),
    getSalesforceDataForCustomer(customer.sfAccountId),
    getCustomerWorkItems(customer.id),
    getCustomerAuditLogs(customer.id),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex items-center gap-1 text-sm text-muted-foreground">
        <Link href="/subscriptions/customers" className="hover:text-foreground transition-colors">
          Customers
        </Link>
        <ChevronRight className="size-3.5" />
        <span className="text-foreground font-medium">
          {customer.sfAccountName ?? customer.domain ?? customer.id}
        </span>
      </nav>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {customer.sfAccountName ?? "Unnamed Customer"}
          </h1>
          <p className="text-sm text-muted-foreground">
            {[customer.domain, customer.stripeCustomerId, customer.sfAccountId]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <CustomerTabs
        customer={customer}
        stripeData={stripeData}
        salesforceData={salesforceData}
        workItems={workItems}
        auditLogs={auditLogs}
        mockFlags={{ stripe: flags.useMockStripe, salesforce: flags.useMockSalesforce }}
      />
    </div>
  );
}
```

## `subscriptions/customers/[id]/tabs/audit-tab.tsx`

```tsx
// Re-export from shared location
export { AuditTab } from "@/components/customer/tabs/audit-tab";
```

## `subscriptions/customers/[id]/tabs/overview-tab.tsx`

```tsx
// Re-export from shared location
export { OverviewTab } from "@/components/customer/tabs/overview-tab";
```

## `subscriptions/customers/[id]/tabs/salesforce-tab.tsx`

```tsx
// Re-export from shared location
export { SalesforceTab } from "@/components/customer/tabs/salesforce-tab";
```

## `subscriptions/customers/[id]/tabs/stripe-tab.tsx`

```tsx
// Re-export from shared location
export { StripeTab } from "@/components/customer/tabs/stripe-tab";
```

## `subscriptions/customers/[id]/tabs/work-items-tab.tsx`

```tsx
// Re-export from shared location
export { WorkItemsTab } from "@/components/customer/tabs/work-items-tab";
```

## `subscriptions/customers/page.tsx`

```tsx
import Link from "next/link";
import { searchCustomersUnified } from "@/lib/queries/customers";
import { SearchForm } from "./search-form";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Props {
  searchParams: Promise<{ q?: string }>;
}

const SOURCE_LABELS = {
  local: { label: "Local DB", variant: "outline" as const },
  salesforce: { label: "Salesforce", variant: "default" as const },
  stripe: { label: "Stripe", variant: "secondary" as const },
};

export default async function CustomersPage({ searchParams }: Props) {
  const { q } = await searchParams;
  const query = q?.trim() ?? "";
  const customers = query.length >= 2 ? await searchCustomersUnified(query) : [];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-sm text-muted-foreground">
          Search across local database, Salesforce Accounts, and Stripe Customers.
        </p>
      </div>

      <SearchForm defaultValue={query} />

      {query.length >= 2 && (
        <>
          <p className="text-sm text-muted-foreground">
            {customers.length} result{customers.length !== 1 ? "s" : ""} for &ldquo;{query}&rdquo;
          </p>

          {customers.length > 0 ? (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[180px]">Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Domain</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Stripe ID</TableHead>
                    <TableHead>Salesforce ID</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customers.map((c) => {
                    const src = SOURCE_LABELS[c.source];
                    const detailHref = c.source === "local"
                      ? `/subscriptions/customers/${c.id}`
                      : null;

                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          {detailHref ? (
                            <Link
                              href={detailHref}
                              className="font-medium hover:underline"
                            >
                              {c.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{c.name}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.email ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {c.domain ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={src.variant}>{src.label}</Badge>
                        </TableCell>
                        <TableCell>
                          {c.stripeCustomerId ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {c.stripeCustomerId}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {c.sfAccountId ? (
                            <Badge variant="outline" className="font-mono text-xs">
                              {c.sfAccountId}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed py-12 text-center">
              <p className="text-sm font-medium">No customers found</p>
              <p className="text-sm text-muted-foreground">
                Try a different search term.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

## `subscriptions/customers/search-form.tsx`

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition, useRef, useEffect } from "react";
import { Search, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";

export function SearchForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleChange(value: string) {
    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString());
        if (value.trim()) {
          params.set("q", value.trim());
        } else {
          params.delete("q");
        }
        router.replace(`/subscriptions/customers?${params.toString()}`);
      });
    }, 300);
  }

  return (
    <div className="relative max-w-md">
      <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
      {isPending && (
        <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground" />
      )}
      <Input
        ref={inputRef}
        type="search"
        placeholder="Search customers…"
        defaultValue={defaultValue}
        onChange={(e) => handleChange(e.target.value)}
        className="pl-9"
      />
    </div>
  );
}
```

## `subscriptions/dashboard-section.tsx`

```tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DollarSign,
  AlertTriangle,
  TrendingDown,
  Zap,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
} from "recharts";
import type {
  SubscriptionDashboardData,
  DashboardSubscription,
} from "@/lib/queries/subscriptions-dashboard";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
import { DashboardSkeleton } from "./dashboard-skeleton";
import { formatCurrency, formatCompactCurrency } from "@/lib/format";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#9333ea",
  "#f59e0b",
  "#64748b",
];

const STATUS_COLOR: Record<string, string> = {
  active: "var(--chart-1)",
  past_due: "var(--chart-4)",
  trialing: "var(--chart-3)",
  canceled: "#64748b",
  incomplete: "var(--chart-5)",
  incomplete_expired: "#94a3b8",
  paused: "#f59e0b",
  unpaid: "#ef4444",
};

const STATUS_BADGE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  active: "default",
  past_due: "destructive",
  trialing: "secondary",
  canceled: "outline",
  incomplete: "secondary",
  incomplete_expired: "outline",
  paused: "secondary",
  unpaid: "destructive",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatStatusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCollectionMethod(method: string): string {
  return method === "send_invoice" ? "Invoice" : "Auto-charge";
}

const RADIAN = Math.PI / 180;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function renderPieLabel(props: any) {
  const cx = Number(props.cx ?? 0);
  const cy = Number(props.cy ?? 0);
  const midAngle = Number(props.midAngle ?? 0);
  const outerRadius = Number(props.outerRadius ?? 0);
  const name = String(props.name ?? "");
  const percent = Number(props.percent ?? 0);
  const radius = outerRadius + 28;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);
  return (
    <text
      x={x}
      y={y}
      textAnchor={x > cx ? "start" : "end"}
      dominantBaseline="central"
      className="fill-foreground text-xs font-semibold"
    >
      {name} ({(percent * 100).toFixed(0)}%)
    </text>
  );
}

const ALL = "__all__";

export function SubscriptionsDashboard() {
  const [data, setData] = useState<SubscriptionDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/subscriptions-dashboard")
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((json) => {
        if (!cancelled) setData(json);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message ?? "Failed to load subscription data.");
      });
    return () => { cancelled = true; };
  }, []);

  if (error) {
    return (
      <div className="rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (!data) return <DashboardSkeleton />;

  return <DashboardContent data={data} />;
}

function DashboardContent({ data }: { data: SubscriptionDashboardData }) {
  const { kpis, statusBreakdown, collectionBreakdown, subscriptions, totalSubscriptionCount } = data;
  const [statusFilter, setStatusFilter] = useState(ALL);

  const filteredSubs = useMemo(
    () =>
      statusFilter === ALL
        ? subscriptions
        : subscriptions.filter((s) => s.status === statusFilter),
    [subscriptions, statusFilter],
  );

  const sortedSubs = useMemo(
    () => [...filteredSubs].sort((a, b) => b.mrr - a.mrr),
    [filteredSubs],
  );

  const statuses = useMemo(
    () => Array.from(new Set(subscriptions.map((s) => s.status))).sort(),
    [subscriptions],
  );

  const pieData = useMemo(
    () =>
      statusBreakdown
        .filter((s) => s.count > 0)
        .map((s) => ({
          name: formatStatusLabel(s.status),
          value: s.count,
          color: STATUS_COLOR[s.status] ?? CHART_COLORS[0],
        })),
    [statusBreakdown],
  );

  const barData = useMemo(
    () =>
      collectionBreakdown.map((c) => ({
        name: formatCollectionMethod(c.method),
        subscriptions: c.count,
        mrr: c.mrr / 100,
      })),
    [collectionBreakdown],
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Row 1: KPI Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          title="Active MRR"
          value={formatCompactCurrency(kpis.activeMrr)}
          subtitle={`${kpis.activeCount} active subscription${kpis.activeCount !== 1 ? "s" : ""}`}
          icon={<DollarSign className="size-4 text-muted-foreground" />}
        />
        <KpiCard
          title="Past Due"
          value={String(kpis.pastDueCount)}
          subtitle={`${formatCurrency(kpis.pastDueRevenue)} at risk`}
          icon={<AlertTriangle className="size-4 text-red-500" />}
          variant={kpis.pastDueCount > 0 ? "warning" : "default"}
        />
        <KpiCard
          title="Churning"
          value={String(kpis.churningCount)}
          subtitle={`${formatCurrency(kpis.churningRevenue)} MRR impact`}
          icon={<TrendingDown className="size-4 text-amber-500" />}
          variant={kpis.churningCount > 0 ? "destructive" : "default"}
        />
        <KpiCard
          title="Trialing"
          value={String(kpis.trialingCount)}
          subtitle={
            kpis.trialingCount > 0
              ? `~${kpis.avgTrialDaysRemaining}d avg remaining`
              : "No active trials"
          }
          icon={<Zap className="size-4 text-muted-foreground" />}
        />
      </div>

      {/* Row 2: Charts */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
            <CardDescription>
              Subscription count by current status
            </CardDescription>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    nameKey="name"
                    label={renderPieLabel}
                    labelLine={false}
                  >
                    {pieData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => [`${Number(value) || 0}`, "Count"]}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No subscriptions found.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Collection Method Split
            </CardTitle>
            <CardDescription>
              Auto-charge vs Invoice — count and MRR
            </CardDescription>
          </CardHeader>
          <CardContent>
            {barData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={barData} layout="vertical" barCategoryGap={12}>
                  <XAxis type="number" tickFormatter={(v) => `$${v}`} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value, name) => {
                      const v = Number(value) || 0;
                      if (name === "mrr")
                        return [`$${v.toLocaleString()}`, "MRR"];
                      return [v, "Subscriptions"];
                    }}
                  />
                  <Legend />
                  <Bar
                    dataKey="mrr"
                    name="MRR ($)"
                    fill="var(--chart-1)"
                    radius={[0, 4, 4, 0]}
                  />
                  <Bar
                    dataKey="subscriptions"
                    name="Count"
                    fill="var(--chart-3)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                No data available.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 3: Subscriptions Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">All Subscriptions</CardTitle>
              <CardDescription>
                {statusFilter !== ALL
                  ? `${filteredSubs.length} of ${totalSubscriptionCount} — ${formatStatusLabel(statusFilter)}`
                  : `Top ${subscriptions.length} of ${totalSubscriptionCount} by MRR`}
              </CardDescription>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                {statuses.map((s) => (
                  <SelectItem key={s} value={s}>
                    {formatStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Customer</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">MRR</TableHead>
                  <TableHead>Period End</TableHead>
                  <TableHead>Collection</TableHead>
                  <TableHead>Products</TableHead>
                  <TableHead>Flags</TableHead>
                  <TableHead>Created</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSubs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-sm text-muted-foreground"
                    >
                      No subscriptions match the current filter.
                    </TableCell>
                  </TableRow>
                ) : (
                  sortedSubs.map((sub) => (
                    <SubscriptionRow key={sub.id} sub={sub} />
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Subcomponents ──

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  variant = "default",
}: {
  title: string;
  value: string;
  subtitle: string;
  icon?: React.ReactNode;
  variant?: "default" | "warning" | "destructive";
}) {
  const borderClass =
    variant === "warning"
      ? "border-amber-500/30"
      : variant === "destructive"
        ? "border-destructive/30"
        : "";

  return (
    <Card className={borderClass}>
      <CardContent className="flex items-start gap-4 pt-5">
        {icon && (
          <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border bg-muted/50">
            {icon}
          </div>
        )}
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-bold tabular-nums tracking-tight">{value}</p>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function SubscriptionRow({ sub }: { sub: DashboardSubscription }) {
  const productSummary =
    sub.items.length <= 2
      ? sub.items.map((i) => i.productName).join(", ")
      : `${sub.items[0].productName} +${sub.items.length - 1} more`;

  return (
    <TableRow>
      <TableCell className="max-w-[200px] truncate font-medium">
        {sub.customerName}
      </TableCell>
      <TableCell>
        <Badge variant={STATUS_BADGE_VARIANT[sub.status] ?? "outline"}>
          {formatStatusLabel(sub.status)}
        </Badge>
      </TableCell>
      <TableCell className="text-right font-mono text-sm">
        {formatCurrency(sub.mrr)}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(sub.currentPeriodEnd)}
      </TableCell>
      <TableCell className="text-sm">
        {formatCollectionMethod(sub.collectionMethod)}
      </TableCell>
      <TableCell
        className="max-w-[200px] truncate text-sm text-muted-foreground"
        title={sub.items.map((i) => i.productName).join(", ")}
      >
        {productSummary}
      </TableCell>
      <TableCell>
        <div className="flex gap-1">
          {sub.cancelAtPeriodEnd && (
            <Badge variant="destructive" className="text-[10px]">
              Canceling
            </Badge>
          )}
          {sub.hasSchedule && (
            <Badge variant="secondary" className="text-[10px]">
              Scheduled
            </Badge>
          )}
          {sub.hasDiscount && (
            <Badge variant="secondary" className="text-[10px]">
              Discount
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {formatDate(sub.created)}
      </TableCell>
    </TableRow>
  );
}
```

## `subscriptions/dashboard-skeleton.tsx`

```tsx
import { Card, CardContent, CardHeader } from "@/components/ui/card";

function Pulse({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-muted ${className ?? ""}`} />;
}

function KpiCardSkeleton() {
  return (
    <Card>
      <CardContent className="flex flex-col gap-2 pt-6">
        <Pulse className="h-3 w-20" />
        <Pulse className="h-7 w-24" />
        <Pulse className="h-3 w-32" />
      </CardContent>
    </Card>
  );
}

function ChartCardSkeleton() {
  return (
    <Card>
      <CardHeader className="space-y-2">
        <Pulse className="h-4 w-36" />
        <Pulse className="h-3 w-52" />
      </CardHeader>
      <CardContent>
        <Pulse className="h-[280px] w-full" />
      </CardContent>
    </Card>
  );
}

function TableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Pulse className="h-4 w-32" />
            <Pulse className="h-3 w-24" />
          </div>
          <Pulse className="h-9 w-[180px] rounded-md" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex gap-4">
            {Array.from({ length: 7 }).map((_, i) => (
              <Pulse key={i} className="h-4 flex-1" />
            ))}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4">
              {Array.from({ length: 7 }).map((_, j) => (
                <Pulse key={j} className="h-5 flex-1" />
              ))}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ChartCardSkeleton />
        <ChartCardSkeleton />
      </div>
      <TableSkeleton />
    </div>
  );
}
```

## `subscriptions/downgrade/page.tsx`

```tsx
import { TrendingDown } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function DowngradePage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Downgrade</h1>
        <p className="text-sm text-muted-foreground">
          Move a customer to a lower-tier plan or reduce quantities.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <TrendingDown className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">Coming Soon</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Select a customer's active subscription and downgrade their plan, reduce seats, or decrease quantities with credit handling.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## `subscriptions/loading.tsx`

```tsx
import { DashboardSkeleton } from "./dashboard-skeleton";

export default function Loading() {
  return (
    <div className="flex flex-col gap-8">
      <div className="space-y-2">
        <div className="animate-pulse rounded bg-muted h-7 w-64" />
        <div className="animate-pulse rounded bg-muted h-4 w-96" />
      </div>
      <DashboardSkeleton />
    </div>
  );
}
```

## `subscriptions/page.tsx`

```tsx
import Link from "next/link";
import { Suspense } from "react";
import { Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SubscriptionsDashboard } from "./dashboard-section";

const QUICK_ACTIONS = [
  { label: "Create Subscription", href: "/subscriptions/create", icon: Plus },
] as const;

export default function SubscriptionsPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Subscription Manager</h1>
        <p className="text-sm text-muted-foreground">
          Manage the full subscription lifecycle — create, modify, and cancel Stripe subscriptions.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {QUICK_ACTIONS.map(({ label, href, icon: Icon }) => (
          <Link key={href} href={href}>
            <Card className="transition-colors hover:border-primary/50 hover:bg-muted/50">
              <CardContent className="flex items-center gap-1.5 px-3 py-2">
                <Icon className="size-4 text-muted-foreground" />
                <span className="text-sm font-medium whitespace-nowrap">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Suspense fallback={<div className="animate-pulse bg-muted h-64 rounded" />}>
        <SubscriptionsDashboard />
      </Suspense>
    </div>
  );
}
```

## `subscriptions/renewal/page.tsx`

```tsx
import { RotateCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function RenewalPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Renewal</h1>
        <p className="text-sm text-muted-foreground">
          Renew expiring subscriptions with updated terms.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <RotateCw className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">Coming Soon</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Identify subscriptions approaching expiration, review terms, apply updated pricing, and extend the subscription period.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

## `subscriptions/upsell/page.tsx`

```tsx
import { TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function UpsellPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Upsell</h1>
        <p className="text-sm text-muted-foreground">
          Upgrade a customer to a higher-tier plan or increase quantities.
        </p>
      </div>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-16">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <TrendingUp className="size-6 text-muted-foreground" />
          </div>
          <div className="text-center">
            <h2 className="font-semibold">Coming Soon</h2>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Select a customer's active subscription and upgrade their plan, add seats, or increase quantities with prorated billing.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

