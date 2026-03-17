/**
 * Omni projection layer — UI-facing read models.
 *
 * Projections compose from mirror tables + product tables and enforce guardrails.
 * Build product screens on projections, not on raw mirror tables.
 *
 * See docs/schema-architecture-map.md for which raw models are safe to query directly.
 * See docs/source-of-truth.md for field-level authority rules.
 */

// Types
export type {
  CustomerView,
  CustomerDirectoryRow,
  CustomerDirectoryTotals,
  SubscriptionView,
  SubscriptionItemView,
  InvoiceView,
  ContractView,
  UnifiedInvoiceRow,
  UnifiedPaymentRow,
  QuoteView,
  RenewalView,
} from "./types";

// CustomerView
export { getCustomerView, getCustomerViewList } from "./customer-view";

// CustomerDirectoryRow + CustomerDirectoryTotals
export { getCustomerDirectory } from "./customer-directory";
export type { CustomerDirectoryResult } from "./customer-directory";

// SubscriptionView
export {
  getSubscriptionView,
  getCustomerSubscriptionViews,
} from "./subscription-view";

// InvoiceView
export { getCustomerInvoiceViews, getInvoiceView } from "./invoice-view";

// ContractView
export { getCustomerContractViews } from "./contract-view";

// UnifiedInvoiceRow + UnifiedPaymentRow
export { getCustomerUnifiedInvoices, getCustomerUnifiedPayments } from "./unified-views";

// QuoteView
export { getQuoteView, getQuoteViewList, getCustomerQuoteViews } from "./quote-view";

// RenewalView
export { getRenewalView, getRenewalViewsForWindow } from "./renewal-view";

// Route resolution
export { resolveCustomerIndexId } from "./resolve-customer";
