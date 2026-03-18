export const dynamic = "force-dynamic";
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
import { PageHeader } from "@/components/workspace/page-header";
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
      <PageHeader
        title="Customer Success"
        description="Account health overview and subscription lifecycle management."
        actions={
          <Button asChild>
            <Link href="/cs/renewals">
              View Renewals
              <ArrowRight className="ml-1 size-4" />
            </Link>
          </Button>
        }
      />

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
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-muted/50">
          {icon}
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="text-xs font-medium text-muted-foreground">
            {title}
          </p>
          <p className="text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
          {subtitle && (
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
