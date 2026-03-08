"use server";

import { cached } from "@/lib/cache";
import { prisma } from "@omnibridge/db";
import { flags } from "@/lib/feature-flags";

export interface UnifiedCustomer {
  id: string;
  name: string;
  email: string | null;
  domain: string | null;
  stripeCustomerId: string | null;
  sfAccountId: string | null;
  source: "local" | "salesforce" | "stripe";
}

export async function searchCustomers(query: string) {
  if (!query || query.length < 2) return [];

  return prisma.customerIndex.findMany({
    where: {
      OR: [
        { sfAccountName: { contains: query, mode: "insensitive" } },
        { domain: { contains: query, mode: "insensitive" } },
        { stripeCustomerId: { contains: query, mode: "insensitive" } },
        { sfAccountId: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { sfAccountName: "asc" },
    take: 50,
  });
}

export async function searchCustomersUnified(query: string): Promise<UnifiedCustomer[]> {
  if (!query || query.length < 2) return [];

  const seen = new Set<string>();
  const results: UnifiedCustomer[] = [];

  const dbResults = await prisma.customerIndex.findMany({
    where: {
      OR: [
        { sfAccountName: { contains: query, mode: "insensitive" } },
        { domain: { contains: query, mode: "insensitive" } },
        { stripeCustomerId: { contains: query, mode: "insensitive" } },
        { sfAccountId: { contains: query, mode: "insensitive" } },
      ],
    },
    orderBy: { sfAccountName: "asc" },
    take: 50,
  });

  for (const c of dbResults) {
    const key = c.sfAccountId ?? c.stripeCustomerId ?? c.id;
    seen.add(key);
    results.push({
      id: c.id,
      name: c.sfAccountName ?? "—",
      email: null,
      domain: c.domain,
      stripeCustomerId: c.stripeCustomerId,
      sfAccountId: c.sfAccountId,
      source: "local",
    });
  }

  const [sfdcResults, stripeResults] = await Promise.all([
    searchSalesforceAccounts(query),
    searchStripeCustomers(query),
  ]);

  for (const a of sfdcResults) {
    if (a.sfAccountId && seen.has(a.sfAccountId)) continue;
    if (a.sfAccountId) seen.add(a.sfAccountId);
    results.push(a);
  }

  for (const s of stripeResults) {
    if (s.stripeCustomerId && seen.has(s.stripeCustomerId)) continue;
    if (s.stripeCustomerId) seen.add(s.stripeCustomerId);
    results.push(s);
  }

  return results;
}

async function searchSalesforceAccounts(query: string): Promise<UnifiedCustomer[]> {
  if (flags.useMockSalesforce) return [];

  try {
    const { searchAccounts } = await import("@omnibridge/salesforce");
    const accounts = await searchAccounts(query) as {
      Id: string;
      Name: string;
      Website: string | null;
      Industry: string | null;
    }[];

    return accounts.map((a) => ({
      id: `sf_${a.Id}`,
      name: a.Name,
      email: null,
      domain: a.Website ? new URL(a.Website.startsWith("http") ? a.Website : `https://${a.Website}`).hostname.replace(/^www\./, "") : null,
      stripeCustomerId: null,
      sfAccountId: a.Id,
      source: "salesforce" as const,
    }));
  } catch (err) {
    console.error("[searchSalesforceAccounts]", err);
    return [];
  }
}

async function searchStripeCustomers(query: string): Promise<UnifiedCustomer[]> {
  if (flags.useMockStripe) return [];

  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();
    const result = await stripe.customers.search({
      query: `name~"${query}" OR email~"${query}"`,
      limit: 25,
    });

    return result.data.map((c) => ({
      id: `stripe_${c.id}`,
      name: c.name ?? c.email ?? c.id,
      email: c.email,
      domain: null,
      stripeCustomerId: c.id,
      sfAccountId: null,
      source: "stripe" as const,
    }));
  } catch (err) {
    console.error("[searchStripeCustomers]", err);
    return [];
  }
}

export interface MyAccount {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  type: string | null;
  stripeCustomerId: string | null;
  dateOfFirstClosedWon: string | null;
  ownerName: string | null;
  csmName: string | null;
  status: string | null;
  accountValue: number | null;
  totalArr: number | null;
}

function mapSfAccount(a: {
  Id: string;
  Name: string;
  Website: string | null;
  Industry: string | null;
  BillingCity: string | null;
  BillingState: string | null;
  Type: string | null;
  Stripe_Customer_ID__c: string | null;
  Date_of_First_Closed_Won__c: string | null;
  Owner: { Name: string } | null;
  Account_Team_CSM__r: { Name: string } | null;
  Status_Calculated__c: string | null;
  Account_Value__c: number | null;
  Total_ARR__c: number | null;
}): MyAccount {
  return {
    id: a.Id,
    name: a.Name,
    website: a.Website,
    industry: a.Industry,
    city: a.BillingCity,
    state: a.BillingState,
    type: a.Type,
    stripeCustomerId: a.Stripe_Customer_ID__c,
    dateOfFirstClosedWon: a.Date_of_First_Closed_Won__c,
    ownerName: a.Owner?.Name ?? null,
    csmName: a.Account_Team_CSM__r?.Name ?? null,
    status: a.Status_Calculated__c,
    accountValue: a.Account_Value__c,
    totalArr: a.Total_ARR__c,
  };
}

async function _fetchMyAccountsFromApi(email: string): Promise<MyAccount[]> {
  const { getUserIdByEmail, getAccountsByCsm } = await import("@omnibridge/salesforce");
  const userId = await getUserIdByEmail(email);
  if (!userId) return [];

  const accounts = await getAccountsByCsm(userId);
  return accounts.map(mapSfAccount);
}

function getCachedMyAccounts(email: string) {
  return cached(
    () => _fetchMyAccountsFromApi(email),
    `my-accounts:${email}`,
    { revalidate: 120, tags: ["my-accounts"] },
  );
}

export async function getMyAccounts(): Promise<MyAccount[]> {
  const { requireSession } = await import("@omnibridge/auth");
  const session = await requireSession();
  const email = session.user?.email;
  if (!email) throw new Error("No email found on session.");

  if (flags.useMockSalesforce) {
    return [
      { id: "001MOCK001", name: "Acme Corp", website: "acme.com", industry: "Technology", city: "San Francisco", state: "CA", type: "Customer", stripeCustomerId: "cus_mock001", dateOfFirstClosedWon: "2023-03-15", ownerName: "Jane Smith", csmName: "You", status: "Active", accountValue: 4500, totalArr: 54000 },
      { id: "001MOCK002", name: "Widget Inc", website: "widget.io", industry: "Manufacturing", city: "Austin", state: "TX", type: "Customer", stripeCustomerId: null, dateOfFirstClosedWon: "2024-01-10", ownerName: "John Doe", csmName: "You", status: "Active", accountValue: 2000, totalArr: 24000 },
    ];
  }

  try {
    return await getCachedMyAccounts(email);
  } catch (err) {
    console.error("[getMyAccounts] error:", err);
    throw new Error(err instanceof Error ? err.message : "Failed to fetch accounts.");
  }
}

async function _fetchAllAccountsFromApi(): Promise<MyAccount[]> {
  const { getAllAccounts } = await import("@omnibridge/salesforce");
  const accounts = await getAllAccounts();
  return accounts.map(mapSfAccount);
}

function cachedGetAllAccounts() {
  return cached(_fetchAllAccountsFromApi, "all-accounts", {
    revalidate: 300,
    tags: ["all-accounts"],
  });
}

export async function getAllAccountsAdmin(): Promise<MyAccount[]> {
  const { requireSession } = await import("@omnibridge/auth");
  const session = await requireSession();
  const role = (session.user as { role?: string }).role;
  if (role !== "admin") throw new Error("Forbidden: admin only");

  if (flags.useMockSalesforce) {
    return [
      { id: "001MOCK001", name: "Acme Corp", website: "acme.com", industry: "Technology", city: "San Francisco", state: "CA", type: "Customer", stripeCustomerId: "cus_mock001", dateOfFirstClosedWon: "2023-03-15", ownerName: "Jane Smith", csmName: "Alice CSM", status: "Active", accountValue: 4500, totalArr: 54000 },
      { id: "001MOCK002", name: "Widget Inc", website: "widget.io", industry: "Manufacturing", city: "Austin", state: "TX", type: "Customer", stripeCustomerId: null, dateOfFirstClosedWon: "2024-01-10", ownerName: "John Doe", csmName: "Bob CSM", status: "Active", accountValue: 2000, totalArr: 24000 },
      { id: "001MOCK003", name: "Global Systems LLC", website: "globalsys.com", industry: "Technology", city: "New York", state: "NY", type: "Customer", stripeCustomerId: "cus_mock003", dateOfFirstClosedWon: "2022-06-01", ownerName: "Jane Smith", csmName: "Alice CSM", status: "Churned", accountValue: 0, totalArr: 0 },
    ];
  }

  try {
    return await cachedGetAllAccounts();
  } catch (err) {
    console.error("[getAllAccountsAdmin] error:", err);
    throw new Error(err instanceof Error ? err.message : "Failed to fetch all accounts.");
  }
}

export interface AccountDetail {
  id: string;
  name: string;
  website: string | null;
  industry: string | null;
  type: string | null;
  stripeCustomerId: string | null;
  dateOfFirstClosedWon: string | null;
  accountValue: number | null;
  totalArr: number | null;
  lifetimeValue: number | null;
  outstandingAr: number | null;
  arStatus: string | null;
  primaryContactName: string | null;
  primaryContactEmail: string | null;
  dashboardEmail: string | null;
  billToContactName: string | null;
  billToEmail: string | null;
  shippingAddress: { street: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null };
  billingAddress: { street: string | null; city: string | null; state: string | null; postalCode: string | null; country: string | null };
  accountNotes: string | null;
  churnDetails: string | null;
  arNotes: string | null;
  latestHealthUpdate: string | null;
}

async function _fetchAccountDetailFromApi(accountId: string): Promise<AccountDetail | null> {
  const { getAccountDetail } = await import("@omnibridge/salesforce");
  const a = await getAccountDetail(accountId);
  if (!a) return null;

  return {
    id: a.Id,
    name: a.Name,
    website: a.Website,
    industry: a.Industry,
    type: a.Type,
    stripeCustomerId: a.Stripe_Customer_ID__c,
    dateOfFirstClosedWon: a.Date_of_First_Closed_Won__c,
    accountValue: a.Account_Value__c,
    totalArr: a.Total_ARR__c,
    lifetimeValue: a.Lifetime_Value_SFBilling_and_stripe__c,
    outstandingAr: a.Outstanding_AR__c,
    arStatus: a.AR_Status__c,
    primaryContactName: a.F52_Primary_Contact__r?.Name ?? null,
    primaryContactEmail: a.Primary_Contact_Email__c,
    dashboardEmail: a.Dashboard_Email__c,
    billToContactName: a.blng__BillToContact__r?.Name ?? null,
    billToEmail: a.Bill_To_Email__c,
    shippingAddress: {
      street: a.ShippingStreet,
      city: a.ShippingCity,
      state: a.ShippingState,
      postalCode: a.ShippingPostalCode,
      country: a.ShippingCountry,
    },
    billingAddress: {
      street: a.BillingStreet,
      city: a.BillingCity,
      state: a.BillingState,
      postalCode: a.BillingPostalCode,
      country: a.BillingCountry,
    },
    accountNotes: a.Account_notes__c,
    churnDetails: a.Churn_Details__c,
    arNotes: a.AR_Notes__c,
    latestHealthUpdate: a.Latest_Health_Update_text__c,
  };
}

function getCachedAccountDetail(accountId: string) {
  return cached(
    () => _fetchAccountDetailFromApi(accountId),
    `account-detail:${accountId}`,
    { revalidate: 120, tags: ["account-detail"] },
  );
}

export async function getAccountDetailById(accountId: string): Promise<AccountDetail | null> {
  const { requireSession } = await import("@omnibridge/auth");
  await requireSession();

  if (flags.useMockSalesforce) {
    return {
      id: accountId,
      name: "Acme Corp (Mock)",
      website: "acme.com",
      industry: "Technology",
      type: "Customer",
      stripeCustomerId: "cus_mock001",
      dateOfFirstClosedWon: "2023-03-15",
      accountValue: 4500,
      totalArr: 54000,
      lifetimeValue: 162000,
      outstandingAr: 12500,
      arStatus: "Current",
      primaryContactName: "Jane Smith",
      primaryContactEmail: "jane@acme.com",
      dashboardEmail: "dashboard@acme.com",
      billToContactName: "John Doe",
      billToEmail: "billing@acme.com",
      shippingAddress: { street: "123 Main St", city: "San Francisco", state: "CA", postalCode: "94105", country: "US" },
      billingAddress: { street: "456 Market St", city: "San Francisco", state: "CA", postalCode: "94105", country: "US" },
      accountNotes: "Enterprise customer, high-touch required.",
      churnDetails: null,
      arNotes: null,
      latestHealthUpdate: "Customer is healthy, renewed Q1 2026.",
    };
  }

  try {
    return await getCachedAccountDetail(accountId);
  } catch (err) {
    console.error("[getAccountDetailById] error:", err);
    throw new Error(err instanceof Error ? err.message : "Failed to fetch account details.");
  }
}

export async function getCustomerById(id: string) {
  return prisma.customerIndex.findUnique({ where: { id } });
}

export async function findCustomerBySfAccountId(sfAccountId: string) {
  if (!sfAccountId) return null;
  return prisma.customerIndex.findUnique({
    where: { sfAccountId },
  });
}

export interface ResolvedCustomer {
  id: string;
  sfAccountId: string | null;
  sfAccountName: string | null;
  stripeCustomerId: string | null;
  domain: string | null;
}

export async function resolveCustomerForOpportunity(
  accountId: string,
  accountName: string | null,
): Promise<ResolvedCustomer | null> {
  if (!accountId) return null;

  const local = await prisma.customerIndex.findUnique({
    where: { sfAccountId: accountId },
  });
  if (local) {
    return {
      id: local.id,
      sfAccountId: local.sfAccountId,
      sfAccountName: local.sfAccountName,
      stripeCustomerId: local.stripeCustomerId,
      domain: local.domain,
    };
  }

  if (!flags.useMockStripe && accountName) {
    try {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();
      const result = await stripe.customers.search({
        query: `name~"${accountName.replace(/"/g, '\\"')}"`,
        limit: 5,
      });
      if (result.data.length > 0) {
        const match = result.data[0];
        return {
          id: `stripe_${match.id}`,
          sfAccountId: accountId,
          sfAccountName: accountName,
          stripeCustomerId: match.id,
          domain: null,
        };
      }
    } catch (err) {
      console.error("[resolveCustomerForOpportunity] Stripe search error:", err);
    }
  }

  if (flags.useMockStripe) {
    return {
      id: `sf_${accountId}`,
      sfAccountId: accountId,
      sfAccountName: accountName,
      stripeCustomerId: `cus_mock_${accountId.slice(-6)}`,
      domain: null,
    };
  }

  return {
    id: `sf_${accountId}`,
    sfAccountId: accountId,
    sfAccountName: accountName,
    stripeCustomerId: null,
    domain: null,
  };
}

export async function getCustomerWorkItems(customerId: string) {
  return prisma.workItem.findMany({
    where: { customerId },
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      assignedTo: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
}

export async function getCustomerAuditLogs(customerId: string) {
  return prisma.auditLog.findMany({
    where: { customerId },
    include: {
      actor: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

export interface AccountContactInfo {
  contactName: string | null;
  contactEmail: string | null;
}

export async function getAccountContactInfo(
  sfAccountId: string,
): Promise<AccountContactInfo> {
  if (flags.useMockSalesforce) {
    return { contactName: "Jane Doe", contactEmail: "jane@example.com" };
  }

  try {
    const { getAccountDetail } = await import("@omnibridge/salesforce");
    const account = await getAccountDetail(sfAccountId);
    if (!account) return { contactName: null, contactEmail: null };

    return {
      contactName: account.F52_Primary_Contact__r?.Name ?? null,
      contactEmail: account.Primary_Contact_Email__c ?? null,
    };
  } catch {
    return { contactName: null, contactEmail: null };
  }
}
