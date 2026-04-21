/**
 * Route-edge types for the Renewals workspace.
 *
 * These are the UI-compatible shapes that route components consume.
 * They were originally defined in lib/queries/cs-renewals.ts but now
 * live here as the adapter-local type boundary.
 *
 * Canonical Omni contracts are the source of truth for data;
 * these types exist only to serve the current UI components.
 */

// ---------------------------------------------------------------------------
// Signal / Status
// ---------------------------------------------------------------------------

export type Signal = "upcoming" | "due_soon" | "past_due";

export type RenewalStatus =
  | "cancelling"
  | "scheduled_end"
  | "period_ending";

// ---------------------------------------------------------------------------
// Linked contract
// ---------------------------------------------------------------------------

export interface LinkedContract {
  id: string;
  accountId: string;
  accountName: string | null;
  contractNumber: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  contractTerm: number | null;
  ownerName: string | null;
  mrr: number | null;
  arr: number | null;
  evergreen: boolean;
  doNotRenew: boolean;
  daysTillExpiry: number | null;
  collectionMethod: string | null;
  lineCount: number;
}

// ---------------------------------------------------------------------------
// Candidate item
// ---------------------------------------------------------------------------

export interface RenewalCandidateItem {
  id: string;
  productName: string;
  unitAmount: number; // cents
  currency: string;
  interval: string | null;
  intervalCount: number;
  quantity: number;
  mrr: number; // cents
}

// ---------------------------------------------------------------------------
// Candidate
// ---------------------------------------------------------------------------

export interface RenewalCandidate {
  id: string;
  candidateId: string;
  customerId: string; // omniAccountId (legacy name kept for UI compat)
  customerName: string;
  csmName: string | null;
  status: string;
  renewalStatus: RenewalStatus;
  signal: Signal;
  mrr: number; // cents
  currency: string;
  currentPeriodEnd: string;
  cancelAt: string | null;
  cancelAtPeriodEnd: boolean;
  hasSchedule: boolean;
  collectionMethod: string;
  items: RenewalCandidateItem[];
  metadata: Record<string, string>;
  contract: LinkedContract | null;
  dueDate: string;
  dueBasis: "contract" | "subscription";
  subscriptionStatus: string | null;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface RenewalsSummary {
  total: number;
  totalMrr: number;
  allCount: number;
  autoRenewCount: number;
  reviewNeededCount: number;
  cancellingCount: number;
  cancellingMrr: number;
  scheduledEndCount: number;
  scheduledEndMrr: number;
  periodEndingCount: number;
  periodEndingMrr: number;
}

// ---------------------------------------------------------------------------
// Dashboard data
// ---------------------------------------------------------------------------

export interface RenewalsDashboardData {
  summary: RenewalsSummary;
  candidates: RenewalCandidate[];
  overdue: RenewalCandidate[];
  csmList: string[];
}

// ---------------------------------------------------------------------------
// Detail
// ---------------------------------------------------------------------------

export interface ContractLineRow {
  id: string;
  productName: string | null;
  quantity: number | null;
  listPrice: number | null;
  netPrice: number | null;
  mrr: number | null;
  billingFrequency: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  stripePriceId: string | null;
  stripeSubItemId: string | null;
}

export interface AccountRow {
  id: string;
  name: string;
  domain: string | null;
  ownerName: string | null;
  csmName: string | null;
  accountType: string | null;
  industry: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingCountry: string | null;
  stripeCustomerId: string | null;
}

export interface RenewalDetailData {
  candidate: RenewalCandidate;
  contractLines: ContractLineRow[];
  account: AccountRow | null;
}
