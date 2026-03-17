/**
 * Shared types for the Omni projection layer.
 *
 * Projections are UI-facing read models that compose from one or more
 * mirror or product tables. They normalize source complexity, enforce guardrails,
 * and expose typed, UI-friendly shapes.
 *
 * Source-of-truth is documented per field where ambiguous.
 * See docs/source-of-truth.md for the full rules.
 */

// ---------------------------------------------------------------------------
// CustomerView — primary account workspace model
// Composes: CustomerIndex + SfAccount + StripeCustomer + active SfContract +
//           active StripeSubscription
// ---------------------------------------------------------------------------

export interface CustomerView {
  // --- Identity (CustomerIndex — canonical mapping layer) ---
  id: string; // CustomerIndex.id
  sfAccountId: string | null;
  stripeCustomerId: string | null;

  // --- Account (SfAccount — authoritative for CRM/commercial identity) ---
  name: string;
  domain: string | null;
  ownerId: string | null;
  ownerName: string | null;
  csmId: string | null;
  csmName: string | null;
  accountType: string | null;
  /** SF account status (not billing status) */
  accountStatus: string | null;
  sfAccountSyncedAt: Date | null;

  // --- Billing (StripeCustomer — authoritative for billing identity) ---
  billingEmail: string | null;
  delinquent: boolean;
  /** Balance in cents. Negative = credit. */
  balanceCents: number;
  currency: string | null;
  stripeCustomerSyncedAt: Date | null;

  // --- Active contract (SfContract — authoritative for commercial terms) ---
  activeContract: {
    id: string;
    contractNumber: string | null;
    status: string;
    startDate: Date | null;
    endDate: Date | null;
    /** Computed from endDate — never from SfContract.daysTillExpiry */
    daysToExpiry: number | null;
    contractTerm: number | null;
    doNotRenew: boolean;
    evergreen: boolean;
    renewalTerm: number | null;
    /** MRR in currency units (not cents) — approximate from SfContract.mrr */
    mrrApprox: number | null;
    arrApprox: number | null;
    syncedAt: Date;
  } | null;

  // --- Active subscription (StripeSubscription — authoritative for billing state) ---
  activeSubscription: {
    id: string;
    /** Billing status — always prefer this over SfContract.stripeStatus */
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: Date;
    syncedAt: Date;
  } | null;
}

// ---------------------------------------------------------------------------
// SubscriptionView — subscription-facing product model
// Composes: StripeSubscription + StripeSubscriptionItem + SfContract (linked)
//           + QuoteRecord (originating)
// ---------------------------------------------------------------------------

export interface SubscriptionItemView {
  id: string; // si_xxx
  productId: string;
  productName: string;
  priceId: string;
  /** Unit amount in cents */
  unitAmountCents: number;
  quantity: number;
  billingInterval: string | null;
  intervalCount: number;
  usageType: string;

  // --- Service period (inherited from parent StripeSubscription) ---
  servicePeriodStart: Date;
  servicePeriodEnd: Date;

  // --- SF correlation (populated by sync path) ---
  /** SfContractLine.id — null if unmatched */
  sfContractLineId: string | null;
  /** SfContractLine.productName — display name of matched SF line */
  sfContractLineName: string | null;
  /** SfContractLine.contractId — parent SfContract.id */
  contractId: string | null;
  /** SfContract.contractNumber — human-readable contract identifier */
  contractNumber: string | null;
  /** Confidence of correlation — matched (exact), candidate (heuristic), unmatched */
  correlationStatus: "matched" | "candidate" | "unmatched";
  /** Method used to establish correlation */
  correlationMethod: "exact_item_id" | "exact_price_id" | "heuristic" | null;
}

export interface SubscriptionView {
  // --- Stripe subscription identity ---
  id: string; // sub_xxx
  customerId: string;
  customerName: string;
  /** Billing status — authoritative */
  status: string;
  collectionMethod: string;
  currency: string;
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  cancelAt: Date | null;
  canceledAt: Date | null;
  startDate: Date;
  hasSchedule: boolean;
  items: SubscriptionItemView[];
  /** MRR in cents — computed from items at query time */
  mrrCents: number;
  syncedAt: Date;

  // --- CustomerIndex linkage ---
  sfAccountId: string | null;

  // --- SfContract (linked via stripeSubscriptionId — authoritative for commercial terms) ---
  sfContract: {
    id: string;
    contractNumber: string | null;
    status: string;
    endDate: Date | null;
    /** Computed from endDate — never from SfContract.daysTillExpiry */
    daysToExpiry: number | null;
    doNotRenew: boolean;
    evergreen: boolean;
  } | null;

  // --- Originating QuoteRecord (linked via stripeSubscriptionId) ---
  originatingQuote: {
    id: string;
    stripeQuoteId: string;
    quoteType: string;
    sfAccountId: string | null;
  } | null;
}

// ---------------------------------------------------------------------------
// InvoiceView — invoice/billing UI model
// Composes: StripeInvoice + StripeCustomer
// NOTE: StripeInvoice.subscriptionId is a bare string (no Prisma relation).
//       See schema-cleanup-candidates.md for FK migration plan.
// ---------------------------------------------------------------------------

export interface InvoiceView {
  id: string; // in_xxx
  customerId: string;
  number: string | null;
  /** Invoice status: draft | open | paid | void | uncollectible */
  status: string | null;
  currency: string;
  amountDueCents: number;
  amountPaidCents: number;
  amountRemainingCents: number;
  totalCents: number;
  dueDate: Date | null;
  paidAt: Date | null;
  hostedInvoiceUrl: string | null;
  invoicePdf: string | null;
  billingReason: string | null;
  collectionMethod: string | null;
  periodStart: Date | null;
  periodEnd: Date | null;
  stripeCreated: Date;
  syncedAt: Date;

  // --- StripeCustomer (authoritative for customer identity) ---
  customerName: string | null;
  customerEmail: string | null;

  // --- Subscription link (FK to StripeSubscription, optional) ---
  subscriptionId: string | null;
}

// ---------------------------------------------------------------------------
// QuoteView — quote-focused UI model
// Composes: QuoteRecord + SfAccount + SfContact
// ---------------------------------------------------------------------------

export interface QuoteView {
  // --- Identity ---
  id: string;
  stripeQuoteId: string;
  stripeQuoteNumber: string | null;
  sfQuoteId: string | null;
  sfQuoteNumber: string | null;
  /** Current quote status: draft | open | accepted | canceled | expired */
  status: string;
  quoteType: string;

  // --- Commercial terms ---
  totalAmountCents: number | null;
  currency: string;
  collectionMethod: string;
  paymentTerms: string | null;
  daysUntilDue: number | null;
  contractTerm: string | null;
  billingFrequency: string | null;
  contractEndDate: Date | null;
  effectiveDate: Date | null;
  effectiveTiming: string | null;
  prorationAmountCents: number | null;

  // --- Customer (from SfAccount via sfAccountId — SF is authoritative for name) ---
  sfAccountId: string | null;
  customerName: string; // QuoteRecord.customerName (snapshot at quote time)
  sfAccountName: string | null; // SfAccount.name (current)
  stripeCustomerId: string;

  // --- Contact (SfContact via billToContactId) ---
  billToContact: {
    id: string;
    firstName: string | null;
    lastName: string;
    email: string | null;
    title: string | null;
  } | null;
  /** Signer details — copied from SfContact at quote time */
  signerName: string | null;
  signerEmail: string | null;

  // --- DocuSign ---
  docusignEnvelopeId: string | null;

  // --- Downstream objects ---
  opportunityId: string | null;
  sfContractId: string | null;
  stripeSubscriptionId: string | null;
  stripeScheduleId: string | null;

  // --- Lifecycle ---
  acceptedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  dryRun: boolean;

  // --- Creator ---
  createdBy: string; // User.id
  createdByName: string | null;
}

// ---------------------------------------------------------------------------
// ContractView — all contracts for a customer
// Composes: SfContract (all statuses, ordered newest first)
// ---------------------------------------------------------------------------

export interface ContractView {
  id: string;
  contractNumber: string | null;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  /** Computed from endDate — never from SfContract.daysTillExpiry */
  daysToExpiry: number | null;
  contractTerm: number | null;
  doNotRenew: boolean;
  evergreen: boolean;
  renewalTerm: number | null;
  /** MRR in currency units — from SfContract.mrr */
  mrrApprox: number | null;
  /** ARR in currency units — from SfContract.arr */
  arrApprox: number | null;
  stripeSubscriptionId: string | null;
  syncedAt: Date;
}

// ---------------------------------------------------------------------------
// UnifiedInvoiceRow — single row for the unified invoice table
// Sources: StripeInvoice (amounts in cents) and SfInvoice (amounts in currency units)
// ---------------------------------------------------------------------------

export interface UnifiedInvoiceRow {
  id: string;
  /** Data origin */
  source: "stripe" | "salesforce";
  number: string | null;
  /** Status string from source system */
  status: string | null;
  currency: string;
  /** Total in cents — normalised for all sources */
  totalCents: number;
  /** Sort/display date: stripeCreated for Stripe, invoiceDate for SF */
  invoiceDate: Date;
  dueDate: Date | null;
  paidAt: Date | null;
  /** Link to source system record */
  externalUrl: string | null;
  /** Amount still outstanding (Stripe only — null for SF) */
  amountDueCents: number | null;
  amountPaidCents: number | null;
  /** Stripe subscription ID if linked (null for SF) */
  subscriptionId: string | null;
}

// ---------------------------------------------------------------------------
// UnifiedPaymentRow — single row for the unified payment table
// Sources: StripePayment (succeeded intents) and SfPayment (mirrored records)
// ---------------------------------------------------------------------------

export interface UnifiedPaymentRow {
  id: string;
  /** Data origin */
  source: "stripe" | "salesforce";
  paymentDate: Date;
  /** Amount in currency units (not cents) */
  amount: number;
  /** Amount in cents — normalised for all sources */
  amountCents: number;
  currency: string;
  status: string;
  /** Human-readable payment method (e.g. "Visa ····4242", "ACH", "Wire") */
  paymentMethod: string | null;
  /** Invoice ID if linked — Stripe: in_xxx, SF: sfInvoiceId */
  invoiceId: string | null;
  /** Link to receipt or source record */
  receiptUrl: string | null;
  /** Reference identifier (pi_xxx for Stripe, check/wire ref for SF) */
  referenceId: string | null;
}

// ---------------------------------------------------------------------------
// CustomerDirectoryRow + CustomerDirectoryTotals — customers landing page model
// Composes: CustomerIndex + SfAccount + SfContract (active) + StripeSubscription (active, with items)
// ---------------------------------------------------------------------------

export interface CustomerDirectoryRow {
  // --- Identity ---
  id: string; // CustomerIndex.id
  sfAccountId: string | null;
  stripeCustomerId: string | null;
  /** SF is authoritative for name; falls back to CustomerIndex.sfAccountName */
  name: string;
  domain: string | null;

  // --- Team (SfAccount) ---
  aeName: string | null; // SfAccount.ownerName
  csmName: string | null;

  // --- Account meta (SfAccount) ---
  accountStatus: string | null;
  accountType: string | null;

  // --- System linkage ---
  hasSalesforce: boolean;
  hasStripe: boolean;

  // --- Active billing state ---
  activeSubscriptionCount: number;
  activeContractCount: number;
  /** MRR in cents — computed from StripeSubscriptionItems at query time */
  mrrCents: number;
  /** ARR in currency units — from nearest SfContract.arr */
  arrApprox: number | null;

  // --- Account history ---
  /** SfAccount.dateOfFirstClosedWon — first time this account converted */
  firstClosedWon: Date | null;

  // --- Nearest renewal ---
  nearestContractEnd: Date | null;
  nearestContractNumber: string | null;
  /** Computed from nearestContractEnd — never from SfContract.daysTillExpiry */
  daysToNearestRenewal: number | null;

  // --- Enumerated references (for search + display) ---
  subscriptionIds: string[];
  contractNumbers: string[];
}

export interface CustomerDirectoryTotals {
  totalCustomers: number;
  /** CustomerIndex entries linked to at least one active subscription or active contract */
  activeCustomers: number;
  sfAccountCount: number;
  stripeCustomerCount: number;
  activeSubscriptionCount: number;
  activeContractCount: number;
  /** Sum of MRR in cents across all active subscriptions */
  totalMrrCents: number;
  /** Sum of ARR in currency units across active contracts */
  totalArrApprox: number;
  /** Customers with nearest contract ending within 30 days */
  renewingIn30d: number;
  /** Customers with nearest contract ending within 90 days */
  renewingIn90d: number;
}

// ---------------------------------------------------------------------------
// RenewalView — renewals workspace model
// Composes: SfContract (timing) + SfAccount (customer) + StripeSubscription
//           (billing state) + Renewal (workflow, if exists)
// NOTE: daysTillExpiry is computed from endDate — never from SfContract.daysTillExpiry
// ---------------------------------------------------------------------------

export interface RenewalView {
  // --- Contract identity ---
  sfContractId: string;
  contractNumber: string | null;

  // --- Customer (SfAccount — SF authoritative) ---
  sfAccountId: string;
  accountName: string;
  stripeCustomerId: string | null;
  customerIndexId: string | null;
  ownerName: string | null;
  csmName: string | null;

  // --- Contract timing (SfContract — SF authoritative) ---
  contractStartDate: Date | null;
  contractEndDate: Date | null;
  contractTerm: number | null;
  renewalTerm: number | null;
  /** Computed from endDate — NEVER from SfContract.daysTillExpiry */
  daysToExpiry: number | null;
  renewalUrgency: "overdue" | "critical" | "due_soon" | "on_track";

  // --- Flags ---
  doNotRenew: boolean;
  evergreen: boolean;

  // --- Commercial ---
  mrrApprox: number | null;
  arrApprox: number | null;

  // --- Billing state (StripeSubscription — Stripe authoritative) ---
  stripeSubscriptionId: string | null;
  /** Billing status — never from SfContract.stripeStatus */
  subscriptionStatus: string | null;

  // --- Workflow (Renewal product entity — once added) ---
  renewal: {
    id: string;
    status: string;
    ownerUserId: string | null;
    targetRenewalDate: Date;
    atRisk: boolean;
    notesSummary: string | null;
  } | null;
}
