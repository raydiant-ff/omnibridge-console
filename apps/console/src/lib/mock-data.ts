// ── Stripe mocks ────────────────────────────────────────────────────────────

export interface MockStripeCustomer {
  id: string;
  name: string;
  email: string;
  currency: string;
  balance: number;
  created: number;
  default_source: string | null;
}

export interface MockStripeSubscription {
  id: string;
  status: string;
  current_period_start: number;
  current_period_end: number;
  plan: { id: string; nickname: string; amount: number; currency: string; interval: string };
}

export interface MockStripeInvoice {
  id: string;
  status: string;
  amount_due: number;
  amount_paid: number;
  currency: string;
  created: number;
  hosted_invoice_url: string;
}

export interface MockStripePaymentMethod {
  id: string;
  type: string;
  card: { brand: string; last4: string; exp_month: number; exp_year: number } | null;
}

export interface MockStripeData {
  customer: MockStripeCustomer;
  subscriptions: MockStripeSubscription[];
  invoices: MockStripeInvoice[];
  paymentMethods: MockStripePaymentMethod[];
}

const now = Math.floor(Date.now() / 1000);
const thirtyDaysAgo = now - 30 * 86400;
const sixtyDaysAgo = now - 60 * 86400;
const thirtyDaysFromNow = now + 30 * 86400;

export function getMockStripeData(stripeCustomerId: string): MockStripeData {
  return {
    customer: {
      id: stripeCustomerId,
      name: "Acme Corp",
      email: "billing@acme.com",
      currency: "usd",
      balance: 0,
      created: sixtyDaysAgo,
      default_source: null,
    },
    subscriptions: [
      {
        id: "sub_mock_001",
        status: "active",
        current_period_start: thirtyDaysAgo,
        current_period_end: thirtyDaysFromNow,
        plan: { id: "price_mock_pro", nickname: "Pro Plan", amount: 9900, currency: "usd", interval: "month" },
      },
      {
        id: "sub_mock_002",
        status: "canceled",
        current_period_start: sixtyDaysAgo,
        current_period_end: thirtyDaysAgo,
        plan: { id: "price_mock_starter", nickname: "Starter Plan", amount: 2900, currency: "usd", interval: "month" },
      },
    ],
    invoices: [
      { id: "in_mock_001", status: "paid", amount_due: 9900, amount_paid: 9900, currency: "usd", created: thirtyDaysAgo, hosted_invoice_url: "#" },
      { id: "in_mock_002", status: "paid", amount_due: 2900, amount_paid: 2900, currency: "usd", created: sixtyDaysAgo, hosted_invoice_url: "#" },
      { id: "in_mock_003", status: "open", amount_due: 9900, amount_paid: 0, currency: "usd", created: now, hosted_invoice_url: "#" },
    ],
    paymentMethods: [
      { id: "pm_mock_001", type: "card", card: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2027 } },
    ],
  };
}

// ── Salesforce mocks ────────────────────────────────────────────────────────

export interface MockSfAccount {
  Id: string;
  Name: string;
  Website: string | null;
  Industry: string | null;
  Type: string | null;
  BillingCity: string | null;
  BillingState: string | null;
  BillingCountry: string | null;
  Phone: string | null;
  AnnualRevenue: number | null;
}

export interface MockSfContact {
  Id: string;
  Name: string;
  Email: string;
  Title: string | null;
  Phone: string | null;
}

export interface MockSfOpportunity {
  Id: string;
  Name: string;
  StageName: string;
  Amount: number | null;
  CloseDate: string;
}

export interface MockSalesforceData {
  account: MockSfAccount;
  contacts: MockSfContact[];
  opportunities: MockSfOpportunity[];
}

export function getMockSalesforceData(sfAccountId: string): MockSalesforceData {
  return {
    account: {
      Id: sfAccountId,
      Name: "Acme Corp",
      Website: "https://acme.com",
      Industry: "Technology",
      Type: "Customer",
      BillingCity: "San Francisco",
      BillingState: "CA",
      BillingCountry: "US",
      Phone: "+1 415-555-0100",
      AnnualRevenue: 5_000_000,
    },
    contacts: [
      { Id: "003MOCK001", Name: "Jane Smith", Email: "jane@acme.com", Title: "VP of Engineering", Phone: "+1 415-555-0101" },
      { Id: "003MOCK002", Name: "John Doe", Email: "john@acme.com", Title: "CTO", Phone: "+1 415-555-0102" },
    ],
    opportunities: [
      { Id: "006MOCK001", Name: "Acme Corp — Pro Upgrade", StageName: "Closed Won", Amount: 118_800, CloseDate: "2025-11-15" },
      { Id: "006MOCK002", Name: "Acme Corp — Enterprise Expansion", StageName: "Negotiation", Amount: 250_000, CloseDate: "2026-03-01" },
    ],
  };
}
