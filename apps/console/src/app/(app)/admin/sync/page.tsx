export const dynamic = "force-dynamic";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWorkspaceTrustSummary } from "@/lib/omni/repo";
import { SyncPageActions } from "./sync-actions";
import { SyncJobsTable } from "./sync-jobs-table";
import { SyncEventsTable } from "./sync-events-table";
import { getDataQualityReport } from "@/lib/queries/data-quality";
import { PageHeader } from "@/components/workspace/page-header";

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
    // Stripe — new mirrors
    stripeInvoiceTotal,
    stripeInvoicePaid,
    stripeInvoiceOpen,
    stripeInvoiceVoid,
    stripePaymentTotal,
    stripePaymentSucceeded,
    stripePaymentFailed,
    stripePmTotal,
    stripePmCard,
    stripePmBank,
    // Salesforce
    sfAccountTotal,
    sfContractTotal,
    sfContractActivated,
    sfContractLineTotal,
    sfContractLineActive,
    // Salesforce — new mirrors
    sfContactTotal,
    sfContactWithEmail,
    sfContactBillTo,
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
    // Stripe — new mirrors
    prisma.stripeInvoice.count(),
    prisma.stripeInvoice.count({ where: { status: "paid" } }),
    prisma.stripeInvoice.count({ where: { status: "open" } }),
    prisma.stripeInvoice.count({ where: { status: { in: ["void", "uncollectible"] } } }),
    prisma.stripePayment.count(),
    prisma.stripePayment.count({ where: { status: "succeeded" } }),
    prisma.stripePayment.count({ where: { status: { in: ["requires_payment_method", "canceled"] } } }),
    prisma.stripePaymentMethod.count(),
    prisma.stripePaymentMethod.count({ where: { type: "card" } }),
    prisma.stripePaymentMethod.count({ where: { type: "us_bank_account" } }),
    // Salesforce
    prisma.sfAccount.count(),
    prisma.sfContract.count(),
    prisma.sfContract.count({ where: { status: "Activated" } }),
    prisma.sfContractLine.count(),
    prisma.sfContractLine.count({ where: { status: "active" } }),
    // Salesforce — new mirrors
    prisma.sfContact.count(),
    prisma.sfContact.count({ where: { email: { not: null } } }),
    prisma.sfContact.count({ where: { isBillTo: true } }),
    // Omni
    prisma.syncEvent.count(),
    prisma.quoteRecord.count(),
    prisma.auditLog.count(),
    // System health
    prisma.syncJob.count({ where: { status: "failed" } }),
    prisma.syncEvent.count({ where: { success: false } }),
  ]);

  const [quality, trustSummary] = await Promise.all([
    getDataQualityReport(),
    getWorkspaceTrustSummary(),
  ]);

  const stripeTotal = stripeCustomerTotal + stripeProductTotal + stripePriceTotal + stripeSubTotal + stripeInvoiceTotal + stripePaymentTotal + stripePmTotal;
  const sfTotal = sfAccountTotal + sfContractTotal + sfContractLineTotal + sfContactTotal;
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
      <PageHeader
        title="Sync Status"
        description="Mirror table health, coverage, and recent sync activity"
        actions={<SyncPageActions />}
      />

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

      {/* ── Mirror Freshness ── */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="Mirror Freshness" detail="Per-source data currency" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {trustSummary.freshness.sources.map((s) => {
            const stateColor = s.freshness.state === "fresh" ? "text-emerald-600"
              : s.freshness.state === "lagging" ? "text-amber-600"
              : s.freshness.state === "stale" ? "text-orange-600"
              : "text-red-600";
            const badgeVariant = s.freshness.state === "fresh" ? "default" as const
              : s.freshness.state === "degraded" ? "destructive" as const
              : "outline" as const;
            const label = s.source.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
            const asOf = s.freshness.dataAsOf
              ? new Date(s.freshness.dataAsOf).toLocaleDateString("en-US", {
                  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                })
              : "Never synced";
            const isMissing = trustSummary.missingSources.some((ms) => ms.source === s.source);
            return (
              <Card key={s.source} className={isMissing ? "border-red-300" : ""}>
                <CardContent className="px-4 py-3">
                  <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={badgeVariant} className="text-[10px]">
                      {isMissing ? "missing" : s.freshness.state}
                    </Badge>
                  </div>
                  <p className={`text-xs mt-1 tabular-nums ${stateColor}`}>
                    {isMissing ? "No rows in mirror" : asOf}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {trustSummary.showWarning && (
          <p className="text-sm text-muted-foreground">{trustSummary.summaryLabel}</p>
        )}
      </section>

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
          <MetricCard
            label="Invoices"
            value={stripeInvoicePaid}
            stats={[
              { label: "total", value: stripeInvoiceTotal },
              { label: "open", value: stripeInvoiceOpen, warn: stripeInvoiceOpen > 0 },
              { label: "void/uncollectible", value: stripeInvoiceVoid },
            ]}
          />
          <MetricCard
            label="Payments"
            value={stripePaymentSucceeded}
            stats={[
              { label: "total", value: stripePaymentTotal },
              { label: "failed/canceled", value: stripePaymentFailed, warn: stripePaymentFailed > 0 },
            ]}
          />
          <MetricCard
            label="Payment Methods"
            value={stripePmTotal}
            stats={[
              { label: "card", value: stripePmCard },
              { label: "bank", value: stripePmBank },
              { label: "other", value: stripePmTotal - stripePmCard - stripePmBank },
            ]}
          />
        </div>
      </section>

      {/* ── Salesforce ── */}
      <section className="flex flex-col gap-3">
        <SectionHeader title="Salesforce" detail="Mirrored via scheduled cron (every 6h) and manual backfill scripts" />
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
          <MetricCard
            label="Contacts"
            value={sfContactTotal}
            stats={[
              { label: "with email", value: sfContactWithEmail },
              { label: "bill-to", value: sfContactBillTo },
            ]}
          />
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
            <QualityCard
              label="Invoice Coverage"
              checks={[
                { label: "Customers with invoices", value: quality.invoiceCoverage.customersWithInvoices, total: quality.invoiceCoverage.customersTotal },
              ]}
            />
            <QualityCard
              label="Payment Method Coverage"
              checks={[
                { label: "Customers with PM", value: quality.paymentMethodCoverage.customersWithPm, total: quality.paymentMethodCoverage.customersTotal },
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
