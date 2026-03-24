/**
 * CS Dashboard types — simplified, object-first model.
 */

export type { OmniAccountSummary, OmniAccountSummaryReport } from "@/lib/omni/contracts";
export type { WorkspaceTrustSummary } from "@/lib/omni/contracts/workspace-trust-types";

import type { WorkspaceTrustSummary } from "@/lib/omni/contracts/workspace-trust-types";

// ---------------------------------------------------------------------------
// Top banner
// ---------------------------------------------------------------------------

export interface BannerMetrics {
  accounts: number;
  needAttention: number;
  totalMrrCents: number;
  totalArrCents: number;
  atRiskArrCents: number;
  billingRisk: number;
  lifecycleBreaks: number;
}

// ---------------------------------------------------------------------------
// Priority row
// ---------------------------------------------------------------------------

export interface PriorityAccountRow {
  omniAccountId: string;
  displayName: string;
  csmName: string | null;
  activeMrrCents: number;
  breakLocation: string;
  riskReason: string;
  severity: "critical" | "high" | "medium";
  isFlagged: boolean;
  href: string;
}

// ---------------------------------------------------------------------------
// Object containers
// ---------------------------------------------------------------------------

export interface OpportunityContainer {
  /** Distinct opportunities referenced by contracts/quotes (locally derived) */
  trackedTotal: number;
  /** Accepted quotes with opportunity_id but no contract */
  noContractFromQuote: number;
  /** NOTE: Stage distribution, closed-won YTD require live SF query — not available locally */
  isPartial: true;
}

export interface QuotesContainer {
  total: number;
  byStatus: { status: string; count: number }[];
  acceptedTotal: number;
  acceptedAmountCents: number;
  acceptedNoSub: number;
  acceptedNoContract: number;
  expiredOpen: number;
}

export interface SubscriptionsContainer {
  total: number;
  active: number;
  trialing: number;
  pastDue: number;
  canceled: number;
  activeMrrCents: number;
  cancelingCount: number;
}

export interface InvoicesContainer {
  stripeTotal: number;
  open: number;
  openAmountCents: number;
  pastDue: number;
  pastDueAmountCents: number;
  paid: number;
  paidAmountCents: number;
  uncollectible: number;
  uncollectibleAmountCents: number;
  mirrorEmpty: boolean;
}

export interface ContractContainer {
  total: number;
  activated: number;
  noStripeSub: number;
  endingThisMonth: number;
  endingThisMonthMrr: number;
}

export interface PaymentsContainer {
  totalYtd: number;
  totalYtdAmountCents: number;
  succeeded: number;
  succeededAmountCents: number;
  failed: number;
  failedAmountCents: number;
  needingAction: number;
}

// ---------------------------------------------------------------------------
// Full dashboard data
// ---------------------------------------------------------------------------

export interface CsDashboardData {
  trust: WorkspaceTrustSummary;
  banner: BannerMetrics;
  priorityRows: PriorityAccountRow[];
  opportunities: OpportunityContainer;
  quotes: QuotesContainer;
  subscriptions: SubscriptionsContainer;
  invoices: InvoicesContainer;
  contracts: ContractContainer;
  payments: PaymentsContainer;
  /** Original lanes for priority table */
  lanes: {
    renewalRisk: import("@/lib/omni/contracts").OmniAccountSummary[];
    dataQuality: import("@/lib/omni/contracts").OmniAccountSummary[];
    missingLinkage: import("@/lib/omni/contracts").OmniAccountSummary[];
    invoiceRisk: import("@/lib/omni/contracts").OmniAccountSummary[];
  };
}

// ---------------------------------------------------------------------------
// Flag types
// ---------------------------------------------------------------------------

export type FlagReason = "missing_linkage" | "data_quality" | "correlation_issue";

// ---------------------------------------------------------------------------
// Account snapshot — per-account object detail for drawer
// ---------------------------------------------------------------------------

export interface AccountSnapshot {
  subscriptions: { id: string; status: string; collectionMethod: string; mrrCents: number; cancelAtPeriodEnd: boolean }[];
  invoices: { id: string; number: string | null; status: string; amountDue: number; amountRemaining: number; dueDate: string | null }[];
  contracts: { id: string; contractNumber: string | null; status: string; startDate: string | null; endDate: string | null; stripeSubId: string | null; mrr: number | null }[];
  quotes: { id: string; status: string; quoteType: string; totalAmount: number | null; sfContractId: string | null; stripeSubId: string | null; opportunityId: string | null }[];
  payments: { id: string; status: string; amount: number; cardLast4: string | null }[];
  isDelinquent: boolean;
  hasDefaultPm: boolean;

  // Lifecycle truth derived from real objects
  lifecycle: {
    hasOpportunity: boolean;
    hasQuote: boolean;
    hasActiveSubscription: boolean;
    hasCurrentInvoice: boolean;
    hasActiveContract: boolean;
    hasHealthyPayment: boolean;
    /** Specific break descriptions */
    breaks: string[];
  };
}
