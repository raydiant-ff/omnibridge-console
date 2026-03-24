"use client";

import { useState, useMemo, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  ArrowRight, AlertTriangle, Info, Flag,
  CheckCircle2, XCircle, X, Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { PageHeader } from "@/components/workspace";
import type {
  CsDashboardData, PriorityAccountRow, OpportunityContainer,
  QuotesContainer, SubscriptionsContainer, InvoicesContainer,
  ContractContainer, PaymentsContainer, AccountSnapshot,
} from "./types";
import { fetchAccountSnapshot } from "./actions";
import type { WorkspaceTrustSummary } from "@/lib/omni/contracts/workspace-trust-types";
import type { OmniAccountSummary } from "@/lib/omni/contracts";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(cents: number): string {
  const d = cents / 100;
  if (d >= 1_000_000) return `$${(d / 1_000_000).toFixed(1)}M`;
  if (d >= 1000) return `$${(d / 1000).toFixed(1)}k`;
  return `$${d.toFixed(0)}`;
}

// ---------------------------------------------------------------------------
// Workspace state types
// ---------------------------------------------------------------------------

type SignalFilter = null | "need_attention" | "billing_risk" | "lifecycle_breaks" | "at_risk";
type ObjectFilter = null | "sub_past_due" | "sub_canceling" | "inv_past_due" | "inv_uncollectible" | "inv_open" | "contract_no_sub" | "contract_ending" | "pay_failed" | "quote_no_contract" | "quote_no_sub" | "opp_no_contract";

// ---------------------------------------------------------------------------
// Signal Band — interactive
// ---------------------------------------------------------------------------

function SignalBand({ b, active, onSelect }: { b: CsDashboardData["banner"]; active: SignalFilter; onSelect: (f: SignalFilter) => void }) {
  const toggle = (f: SignalFilter) => onSelect(active === f ? null : f);
  return (
    <div className="flex flex-wrap items-baseline gap-x-6 gap-y-3 border-b pb-3">
      <Sig label="Accounts" value={b.accounts} />
      <Sig label="Need Attention" value={b.needAttention} urgent={b.needAttention > 0} active={active === "need_attention"} onClick={() => toggle("need_attention")} />
      <Sig label="Total MRR" value={fmt(b.totalMrrCents)} large />
      <Sig label="Total ARR" value={fmt(b.totalArrCents)} />
      <Sig label="At Risk ARR" value={fmt(b.atRiskArrCents)} urgent={b.atRiskArrCents > 0} active={active === "at_risk"} onClick={() => toggle("at_risk")} />
      <Sig label="Billing Risk" value={b.billingRisk} urgent={b.billingRisk > 0} active={active === "billing_risk"} onClick={() => toggle("billing_risk")} />
      <Sig label="Lifecycle Breaks" value={b.lifecycleBreaks} urgent={b.lifecycleBreaks > 0} active={active === "lifecycle_breaks"} onClick={() => toggle("lifecycle_breaks")} />
    </div>
  );
}

function Sig({ label, value, urgent, large, active, onClick }: { label: string; value: string | number; urgent?: boolean; large?: boolean; active?: boolean; onClick?: () => void }) {
  const clickable = !!onClick;
  return (
    <button type="button" onClick={onClick} disabled={!clickable} className={cn("text-left rounded-md px-2 py-1 -mx-2 -my-1 transition-all", clickable && "hover:bg-muted/50 cursor-pointer", active && "bg-primary/5 ring-1 ring-primary/20", !clickable && "cursor-default")}>
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground/70">{label}</p>
      <p className={cn("font-bold tabular-nums tracking-tighter leading-none mt-0.5", large ? "text-3xl" : "text-2xl", urgent ? "text-red-600" : "text-foreground")}>{value}</p>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Trust strip
// ---------------------------------------------------------------------------

function TrustStrip({ trust }: { trust: WorkspaceTrustSummary }) {
  const bad = trust.freshness.overall.state === "degraded" || trust.missingSources.length > 0;
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1 rounded text-[10px] border", bad ? "border-red-200 bg-red-50/20 text-red-600" : "border-amber-200 bg-amber-50/20 text-amber-600")}>
      {bad ? <AlertTriangle className="size-3" /> : <Info className="size-3" />}
      <span className="font-medium truncate">{trust.summaryLabel}</span>
      {trust.missingSources.map(s => <Badge key={s.source} variant="destructive" className="text-[8px]">{s.label}: empty</Badge>)}
      <Link href="/admin/sync" className="ml-auto text-primary hover:underline font-medium">Sync</Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Filter indicator
// ---------------------------------------------------------------------------

function FilterChip({ signal, obj, onClear }: { signal: SignalFilter; obj: ObjectFilter; onClear: () => void }) {
  if (!signal && !obj) return null;
  const labels: Record<string, string> = { need_attention: "Need Attention", billing_risk: "Billing Risk", lifecycle_breaks: "Lifecycle Breaks", at_risk: "At Risk ARR", sub_past_due: "Past Due Subs", sub_canceling: "Canceling Subs", inv_past_due: "Past Due Invoices", inv_uncollectible: "Uncollectible", inv_open: "Open Invoices", contract_no_sub: "No Stripe Sub", contract_ending: "Ending This Month", pay_failed: "Failed Payments", quote_no_contract: "Quote → No Contract", quote_no_sub: "Quote → No Sub", opp_no_contract: "Opp → No Contract" };
  return (
    <Badge variant="secondary" className="text-[10px] gap-1">{labels[(signal ?? obj)!] ?? (signal ?? obj)}<button onClick={onClear}><X className="size-2.5" /></button></Badge>
  );
}

// ---------------------------------------------------------------------------
// Priority Table — reactive
// ---------------------------------------------------------------------------

function PTable({ rows, selectedId, onSelect }: { rows: PriorityAccountRow[]; selectedId: string | null; onSelect: (id: string | null) => void }) {
  if (rows.length === 0) return <div className="border rounded-lg px-4 py-6 text-center bg-card"><CheckCircle2 className="mx-auto mb-1 size-4 text-emerald-500/60" /><p className="text-xs font-medium">No accounts match</p></div>;
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40 h-7">
            <TableHead className="text-[9px] font-bold uppercase tracking-widest px-3 py-0">Account</TableHead>
            <TableHead className="text-[9px] font-bold uppercase tracking-widest px-3 py-0 w-[80px]">CSM</TableHead>
            <TableHead className="text-[9px] font-bold uppercase tracking-widest px-3 py-0 w-[60px] text-right">MRR</TableHead>
            <TableHead className="text-[9px] font-bold uppercase tracking-widest px-3 py-0 w-[130px]">Break</TableHead>
            <TableHead className="text-[9px] font-bold uppercase tracking-widest px-3 py-0 w-[120px]">Risk</TableHead>
            <TableHead className="text-[9px] font-bold uppercase tracking-widest px-3 py-0 w-[40px] text-center">Sev</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map(r => (
            <TableRow key={r.omniAccountId} className={cn("cursor-pointer h-8 transition-colors", selectedId === r.omniAccountId ? "bg-primary/[0.06] border-l-2 border-l-primary" : "hover:bg-primary/[0.03]")} onClick={() => onSelect(selectedId === r.omniAccountId ? null : r.omniAccountId)}>
              <TableCell className="px-3 py-0"><span className="text-[13px] font-semibold inline-flex items-center gap-1 truncate max-w-[200px]">{r.displayName}{r.isFlagged && <Flag className="size-2.5 text-amber-500" />}</span></TableCell>
              <TableCell className="px-3 py-0 text-[11px] text-muted-foreground truncate">{r.csmName ?? "—"}</TableCell>
              <TableCell className="px-3 py-0 text-right text-[12px] font-semibold tabular-nums font-mono">{r.activeMrrCents > 0 ? fmt(r.activeMrrCents) : "—"}</TableCell>
              <TableCell className="px-3 py-0 text-[11px] font-medium">{r.breakLocation}</TableCell>
              <TableCell className="px-3 py-0 text-[11px] text-muted-foreground truncate">{r.riskReason}</TableCell>
              <TableCell className="px-3 py-0 text-center"><span className={cn("inline-block size-2 rounded-full", r.severity === "critical" ? "bg-red-500" : r.severity === "high" ? "bg-amber-500" : "bg-slate-300")} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <div className="border-t px-3 py-1 flex items-center justify-between bg-muted/10">
        <span className="text-[10px] text-muted-foreground tabular-nums">{rows.length} accounts</span>
        <Button variant="ghost" size="sm" className="h-5 text-[10px] text-primary px-1" asChild><Link href="/cs/queue">Full queue <ArrowRight className="size-2.5 ml-0.5" /></Link></Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Object modules — interactive
// ---------------------------------------------------------------------------

function Obj({ title, href, children }: { title: string; href?: string; children: React.ReactNode }) {
  return (
    <div className="border rounded-lg bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/25 border-b">
        <span className="text-[10px] font-bold uppercase tracking-widest">{title}</span>
        {href && <Link href={href} className="text-[9px] text-primary hover:underline font-medium">View</Link>}
      </div>
      <div className="px-3 py-1.5 space-y-0.5">{children}</div>
    </div>
  );
}

function OL({ label, value, sub, danger, warn, active, onClick }: { label: string; value: string | number; sub?: string; danger?: boolean; warn?: boolean; active?: boolean; onClick?: () => void }) {
  const clickable = !!onClick && (typeof value === "number" ? value > 0 : true);
  return (
    <button type="button" onClick={clickable ? onClick : undefined} disabled={!clickable} className={cn("flex items-baseline justify-between text-[11px] w-full text-left px-1 py-0.5 rounded-sm transition-colors", clickable && "hover:bg-muted/40 cursor-pointer", active && "bg-primary/5 ring-1 ring-primary/20", !clickable && "cursor-default")}>
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums font-medium", danger ? "text-red-600" : warn ? "text-amber-600" : "text-foreground")}>{value}{sub && <span className="text-muted-foreground font-normal ml-1">{sub}</span>}</span>
    </button>
  );
}

function OppMod({ d, af, onF }: { d: OpportunityContainer; af: ObjectFilter; onF: (f: ObjectFilter) => void }) {
  return <Obj title="Opportunities" href="/opportunities">
    <OL label="Tracked" value={d.trackedTotal} />
    {d.noContractFromQuote > 0 && <OL label="Accepted → no contract" value={d.noContractFromQuote} danger active={af === "opp_no_contract"} onClick={() => onF("opp_no_contract")} />}
    <p className="text-[8px] text-muted-foreground/50 mt-0.5">Stage requires live SF</p>
  </Obj>;
}

function QuoteMod({ d, af, onF }: { d: QuotesContainer; af: ObjectFilter; onF: (f: ObjectFilter) => void }) {
  return <Obj title="Quotes" href="/quotes">
    <OL label="Total" value={d.total} />
    <OL label="Accepted" value={d.acceptedTotal} sub={d.acceptedAmountCents > 0 ? fmt(d.acceptedAmountCents) : undefined} />
    {d.acceptedNoSub > 0 && <OL label="→ no sub" value={d.acceptedNoSub} danger active={af === "quote_no_sub"} onClick={() => onF("quote_no_sub")} />}
    {d.acceptedNoContract > 0 && <OL label="→ no contract" value={d.acceptedNoContract} danger active={af === "quote_no_contract"} onClick={() => onF("quote_no_contract")} />}
    {d.expiredOpen > 0 && <OL label="Expired" value={d.expiredOpen} warn />}
  </Obj>;
}

function SubMod({ d, af, onF }: { d: SubscriptionsContainer; af: ObjectFilter; onF: (f: ObjectFilter) => void }) {
  return <Obj title="Subscriptions" href="/subscriptions">
    <OL label="Active" value={d.active} sub={d.activeMrrCents > 0 ? `${fmt(d.activeMrrCents)} MRR` : undefined} />
    {d.pastDue > 0 && <OL label="Past due" value={d.pastDue} danger active={af === "sub_past_due"} onClick={() => onF("sub_past_due")} />}
    {d.cancelingCount > 0 && <OL label="Canceling" value={d.cancelingCount} warn active={af === "sub_canceling"} onClick={() => onF("sub_canceling")} />}
    <OL label="Canceled" value={d.canceled} />
  </Obj>;
}

function InvMod({ d, af, onF }: { d: InvoicesContainer; af: ObjectFilter; onF: (f: ObjectFilter) => void }) {
  return <Obj title="Invoices">
    {d.mirrorEmpty ? <div className="flex items-center gap-1 text-[10px] text-red-600 py-1"><XCircle className="size-3" /> Mirror empty</div> : <>
      <OL label="Paid" value={d.paid} sub={d.paidAmountCents > 0 ? fmt(d.paidAmountCents) : undefined} />
      {d.open > 0 && <OL label="Open" value={d.open} sub={fmt(d.openAmountCents)} warn active={af === "inv_open"} onClick={() => onF("inv_open")} />}
      {d.pastDue > 0 && <OL label="Past due" value={d.pastDue} sub={fmt(d.pastDueAmountCents)} danger active={af === "inv_past_due"} onClick={() => onF("inv_past_due")} />}
      {d.uncollectible > 0 && <OL label="Uncollectible" value={d.uncollectible} danger active={af === "inv_uncollectible"} onClick={() => onF("inv_uncollectible")} />}
    </>}
  </Obj>;
}

function ConMod({ d, af, onF }: { d: ContractContainer; af: ObjectFilter; onF: (f: ObjectFilter) => void }) {
  return <Obj title="Contracts" href="/contracts">
    <OL label="Activated" value={d.activated} />
    {d.noStripeSub > 0 && <OL label="No Stripe sub" value={d.noStripeSub} danger active={af === "contract_no_sub"} onClick={() => onF("contract_no_sub")} />}
    {d.endingThisMonth > 0 && <OL label="Ending this month" value={d.endingThisMonth} sub={d.endingThisMonthMrr > 0 ? fmt(d.endingThisMonthMrr) : undefined} warn active={af === "contract_ending"} onClick={() => onF("contract_ending")} />}
  </Obj>;
}

function PayMod({ d, af, onF }: { d: PaymentsContainer; af: ObjectFilter; onF: (f: ObjectFilter) => void }) {
  return <Obj title="Payments">
    <OL label="Succeeded YTD" value={d.succeeded} sub={d.succeededAmountCents > 0 ? fmt(d.succeededAmountCents) : undefined} />
    {d.failed > 0 && <OL label="Failed" value={d.failed} sub={fmt(d.failedAmountCents)} danger active={af === "pay_failed"} onClick={() => onF("pay_failed")} />}
    {d.needingAction > 0 && <OL label="Needing action" value={d.needingAction} warn />}
    {d.totalYtd === 0 && <p className="text-[8px] text-muted-foreground/50">Mirror may be empty</p>}
  </Obj>;
}

// ---------------------------------------------------------------------------
// Customer 360 Drawer
// ---------------------------------------------------------------------------

function Drawer({ account, onClose }: { account: OmniAccountSummary; onClose: () => void }) {
  const [snapshot, setSnapshot] = useState<AccountSnapshot | null>(null);
  const [loading, startLoad] = useTransition();

  useEffect(() => {
    setSnapshot(null);
    startLoad(async () => {
      const s = await fetchAccountSnapshot(account.omniAccountId);
      setSnapshot(s);
    });
  }, [account.omniAccountId]);

  const lc = snapshot?.lifecycle;
  const nodes: { label: string; ok: boolean }[] = lc ? [
    { label: "Opportunity", ok: lc.hasOpportunity },
    { label: "Quote", ok: lc.hasQuote },
    { label: "Subscription", ok: lc.hasActiveSubscription },
    { label: "Invoice", ok: lc.hasCurrentInvoice },
    { label: "Contract", ok: lc.hasActiveContract },
    { label: "Payment", ok: lc.hasHealthyPayment },
  ] : [
    { label: "Opportunity", ok: !!account.sfAccountId },
    { label: "Quote", ok: true },
    { label: "Subscription", ok: account.activeSubscriptionCount > 0 },
    { label: "Invoice", ok: account.pastDueInvoiceCount === 0 },
    { label: "Contract", ok: account.hasSalesforce },
    { label: "Payment", ok: account.pastDueInvoiceCount === 0 },
  ];

  return (
    <div className="w-[360px] border-l bg-card flex flex-col h-full shrink-0 animate-fade-in">
      {/* Header */}
      <div className="px-4 py-3 border-b">
        <div className="flex items-start justify-between">
          <div className="min-w-0">
            <h3 className="text-sm font-bold tracking-tight truncate">{account.displayName}</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">{account.csmName ?? "No CSM"}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="size-3.5 text-muted-foreground" /></button>
        </div>
        {/* Lifecycle summary strip */}
        <div className="flex items-center gap-3 mt-2 text-[11px]">
          <span className="font-bold tabular-nums font-mono">{fmt(account.activeMrrCents)}</span>
          <span className="text-muted-foreground">MRR</span>
          <span className="font-bold tabular-nums font-mono">{fmt(account.activeArrCents)}</span>
          <span className="text-muted-foreground">ARR</span>
        </div>
        {lc && lc.breaks.length > 0 && (
          <div className="mt-2 space-y-0.5">
            {lc.breaks.map((b, i) => (
              <div key={i} className="flex items-center gap-1 text-[10px] text-red-600">
                <XCircle className="size-2.5 shrink-0" /> {b}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: object snapshots */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-w-0">
          {loading && !snapshot && <p className="text-[10px] text-muted-foreground animate-pulse">Loading account objects...</p>}

          {snapshot && (
            <>
              {/* Subscriptions */}
              <ObjSnap title="Subscriptions" count={snapshot.subscriptions.length}>
                {snapshot.subscriptions.length === 0 ? <SnapEmpty>No subscriptions</SnapEmpty> : snapshot.subscriptions.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-[10px]">
                    <span className="font-mono text-muted-foreground truncate max-w-[120px]">{s.id.slice(4, 18)}</span>
                    <Badge variant={s.status === "active" ? "default" : s.status === "past_due" ? "destructive" : "secondary"} className="text-[8px]">{s.status}</Badge>
                  </div>
                ))}
              </ObjSnap>

              {/* Invoices */}
              <ObjSnap title="Invoices" count={snapshot.invoices.length}>
                {snapshot.invoices.length === 0 ? <SnapEmpty>No invoices mirrored</SnapEmpty> : snapshot.invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{inv.number ?? inv.id.slice(3, 15)}</span>
                    <span className={cn("tabular-nums font-mono", inv.status === "open" && inv.amountRemaining > 0 ? "text-amber-600" : inv.status === "paid" ? "text-foreground" : "text-red-600")}>
                      {fmt(inv.amountDue)} <Badge variant={inv.status === "paid" ? "secondary" : inv.status === "open" ? "outline" : "destructive"} className="text-[7px] ml-1">{inv.status}</Badge>
                    </span>
                  </div>
                ))}
              </ObjSnap>

              {/* Contracts */}
              <ObjSnap title="Contracts" count={snapshot.contracts.length}>
                {snapshot.contracts.length === 0 ? <SnapEmpty>No SF contracts</SnapEmpty> : snapshot.contracts.map(c => (
                  <div key={c.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{c.contractNumber ?? c.id.slice(0, 12)}</span>
                    <div className="flex items-center gap-1">
                      {c.mrr != null && <span className="tabular-nums font-mono text-[9px]">{fmt(Math.round(c.mrr * 100))}</span>}
                      <Badge variant={c.status === "Activated" ? "default" : "secondary"} className="text-[7px]">{c.status}</Badge>
                    </div>
                  </div>
                ))}
              </ObjSnap>

              {/* Quotes */}
              <ObjSnap title="Quotes" count={snapshot.quotes.length}>
                {snapshot.quotes.length === 0 ? <SnapEmpty>No Omni quotes</SnapEmpty> : snapshot.quotes.map(q => (
                  <div key={q.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{q.quoteType}</span>
                    <div className="flex items-center gap-1">
                      {q.totalAmount != null && <span className="tabular-nums font-mono text-[9px]">{fmt(q.totalAmount)}</span>}
                      <Badge variant={q.status === "accepted" ? "default" : "secondary"} className="text-[7px]">{q.status}</Badge>
                    </div>
                  </div>
                ))}
              </ObjSnap>

              {/* Payments */}
              <ObjSnap title="Payments" count={snapshot.payments.length}>
                {snapshot.payments.length === 0 ? <SnapEmpty>{snapshot.isDelinquent ? "No payments — delinquent" : "No recent payments"}</SnapEmpty> : snapshot.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between text-[10px]">
                    <span className="text-muted-foreground">{p.cardLast4 ? `····${p.cardLast4}` : p.id.slice(3, 15)}</span>
                    <span className={cn("tabular-nums font-mono", p.status === "succeeded" ? "text-foreground" : "text-red-600")}>{fmt(p.amount)}</span>
                  </div>
                ))}
                {snapshot.isDelinquent && <div className="text-[9px] text-red-600 font-medium mt-0.5">Customer is delinquent</div>}
                {!snapshot.hasDefaultPm && <div className="text-[9px] text-amber-600 mt-0.5">No default payment method</div>}
              </ObjSnap>
            </>
          )}

          {/* Links */}
          <div className="flex flex-wrap gap-1 pt-1 border-t">
            <Button variant="outline" size="sm" className="h-6 text-[9px]" asChild><Link href={`/customers/${encodeURIComponent(account.omniAccountId)}`}>Full detail</Link></Button>
            <Button variant="outline" size="sm" className="h-6 text-[9px]" asChild><Link href={`/cs/renewals?account=${encodeURIComponent(account.omniAccountId)}`}>Renewals</Link></Button>
            <Button variant="outline" size="sm" className="h-6 text-[9px]" asChild><Link href={`/cs/data-quality?account=${encodeURIComponent(account.omniAccountId)}`}>DQ</Link></Button>
          </div>
        </div>

        {/* Right: lifecycle path */}
        <div className="w-[72px] shrink-0 border-l py-4 flex flex-col items-center bg-muted/10">
          {nodes.map((n, i) => (
            <div key={n.label} className="flex flex-col items-center">
              <div className={cn(
                "size-6 rounded-full flex items-center justify-center border-2 transition-colors",
                n.ok ? "border-emerald-400 bg-emerald-50" : "border-red-400 bg-red-50",
              )}>
                {n.ok ? <Check className="size-3 text-emerald-600" /> : <X className="size-3 text-red-600" />}
              </div>
              <span className="text-[7px] font-semibold text-muted-foreground mt-0.5 text-center leading-tight tracking-wide uppercase">{n.label}</span>
              {i < nodes.length - 1 && (
                <div className={cn("w-0.5 h-5 my-1 rounded-full", n.ok && nodes[i+1].ok ? "bg-emerald-300" : "bg-red-300")} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="px-4 py-1.5 border-t text-[9px] text-muted-foreground">{account.freshness.label}</div>
    </div>
  );
}

function ObjSnap({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-foreground">{title}</span>
        <span className="text-[9px] tabular-nums text-muted-foreground">{count}</span>
      </div>
      {children}
    </div>
  );
}

function SnapEmpty({ children }: { children: React.ReactNode }) {
  return <p className="text-[9px] text-muted-foreground/60">{children}</p>;
}

// ---------------------------------------------------------------------------
// Dashboard — coordinated workspace
// ---------------------------------------------------------------------------

export function CsDashboard({ data }: { data: CsDashboardData }) {
  const { trust, banner, priorityRows } = data;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [signalFilter, setSignalFilter] = useState<SignalFilter>(null);
  const [objectFilter, setObjectFilter] = useState<ObjectFilter>(null);

  const allAccounts = useMemo(() => {
    const m = new Map<string, OmniAccountSummary>();
    for (const lane of [data.lanes.renewalRisk, data.lanes.dataQuality, data.lanes.missingLinkage, data.lanes.invoiceRisk]) for (const a of lane) m.set(a.omniAccountId, a);
    return m;
  }, [data.lanes]);

  const filteredRows = useMemo(() => {
    let rows = priorityRows;
    if (signalFilter) {
      switch (signalFilter) {
        case "need_attention": break;
        case "billing_risk": rows = rows.filter(r => r.breakLocation.includes("Invoice") || r.breakLocation.includes("Payment")); break;
        case "lifecycle_breaks": rows = rows.filter(r => r.breakLocation.includes("↔") || r.breakLocation.includes("Contract")); break;
        case "at_risk": rows = rows.filter(r => r.breakLocation.includes("Renewal")); break;
      }
    }
    if (objectFilter) {
      switch (objectFilter) {
        case "sub_past_due": rows = rows.filter(r => r.riskReason.toLowerCase().includes("past due") || r.riskReason.toLowerCase().includes("overdue")); break;
        case "sub_canceling": rows = rows.filter(r => r.riskReason.toLowerCase().includes("cancel")); break;
        case "inv_past_due": case "inv_open": case "inv_uncollectible": rows = rows.filter(r => r.breakLocation.includes("Invoice")); break;
        case "contract_no_sub": rows = rows.filter(r => r.breakLocation.includes("Contract") || r.breakLocation.includes("↔")); break;
        case "contract_ending": rows = rows.filter(r => r.breakLocation.includes("Renewal")); break;
        case "pay_failed": rows = rows.filter(r => r.breakLocation.includes("Payment")); break;
        default: break;
      }
    }
    return rows;
  }, [priorityRows, signalFilter, objectFilter]);

  const selectedAccount = selectedId ? allAccounts.get(selectedId) ?? null : null;

  function onSignal(f: SignalFilter) { setSignalFilter(f); setObjectFilter(null); }
  function onObject(f: ObjectFilter) { setObjectFilter(objectFilter === f ? null : f); setSignalFilter(null); }
  function clearFilters() { setSignalFilter(null); setObjectFilter(null); }

  return (
    <div className="flex h-full">
      <div className="flex-1 min-w-0 flex flex-col gap-3 overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div><h1 className="text-lg font-bold tracking-tight">Customer Success</h1><p className="text-[11px] text-muted-foreground">Revenue lifecycle — opportunity through billing</p></div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button variant="outline" size="sm" className="h-7 text-[11px]" asChild><Link href="/cs/queue">Queue</Link></Button>
            <Button variant="outline" size="sm" className="h-7 text-[11px]" asChild><Link href="/cs/renewals">Renewals</Link></Button>
            <Button variant="outline" size="sm" className="h-7 text-[11px]" asChild><Link href="/cs/data-quality">DQ</Link></Button>
          </div>
        </div>
        {trust.showWarning && <TrustStrip trust={trust} />}
        <SignalBand b={banner} active={signalFilter} onSelect={onSignal} />
        <div>
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-[10px] font-bold uppercase tracking-widest">Priority Accounts</h2>
            <FilterChip signal={signalFilter} obj={objectFilter} onClear={clearFilters} />
          </div>
          <PTable rows={filteredRows} selectedId={selectedId} onSelect={setSelectedId} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2.5">
          <OppMod d={data.opportunities} af={objectFilter} onF={onObject} />
          <QuoteMod d={data.quotes} af={objectFilter} onF={onObject} />
          <SubMod d={data.subscriptions} af={objectFilter} onF={onObject} />
          <InvMod d={data.invoices} af={objectFilter} onF={onObject} />
          <ConMod d={data.contracts} af={objectFilter} onF={onObject} />
          <PayMod d={data.payments} af={objectFilter} onF={onObject} />
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t text-[10px] text-muted-foreground">
          <Link href="/cs/reports" className="hover:text-foreground px-1">Reports</Link><span className="text-border">·</span>
          <Link href="/subscriptions" className="hover:text-foreground px-1">Subscriptions</Link><span className="text-border">·</span>
          <Link href="/customers" className="hover:text-foreground px-1">Customers</Link><span className="text-border">·</span>
          <Link href="/admin/sync" className="hover:text-foreground px-1">Sync</Link>
        </div>
      </div>
      {selectedAccount && <Drawer account={selectedAccount} onClose={() => setSelectedId(null)} />}
    </div>
  );
}
