"use server";

import { requireSession } from "@omnibridge/auth";
import {
  getOpportunitiesByOwnerEmail,
  getOpportunitiesForDashboard,
  getAllOpportunities,
  searchAccounts,
  getOpportunitiesByAccountId,
} from "@omnibridge/salesforce";
import { flags } from "@/lib/feature-flags";
import { cached } from "@/lib/cache";

export interface OpportunityRow {
  id: string;
  name: string;
  accountName: string | null;
  accountId: string | null;
  stageName: string;
  type: string | null;
  amount: number | null;
  closeDate: string;
  createdDate: string;
  lastModified: string;
  ownerName: string | null;
}

const MOCK_OPPORTUNITIES: OpportunityRow[] = [
  {
    id: "006MOCK001",
    name: "Acme Corp - Enterprise Plan",
    accountName: "Acme Corp",
    accountId: "001MOCK001",
    stageName: "Pricing & Negotiation",
    type: "New",
    amount: 48000,
    closeDate: "2026-04-15",
    createdDate: "2026-01-10T08:00:00Z",
    lastModified: "2026-02-18T10:30:00Z",
    ownerName: "Francisco Fiedler",
  },
  {
    id: "006MOCK002",
    name: "Widget Inc - Starter",
    accountName: "Widget Inc",
    accountId: "001MOCK002",
    stageName: "Contract Sent",
    type: "New",
    amount: 12000,
    closeDate: "2026-03-20",
    createdDate: "2026-01-05T14:00:00Z",
    lastModified: "2026-02-17T15:45:00Z",
    ownerName: "Jane Smith",
  },
  {
    id: "006MOCK003",
    name: "TechCo - Renewal",
    accountName: "TechCo",
    accountId: "001MOCK003",
    stageName: "Discovery & Qualification",
    type: "Renewal",
    amount: null,
    closeDate: "2026-06-01",
    createdDate: "2026-02-01T09:30:00Z",
    lastModified: "2026-02-16T09:00:00Z",
    ownerName: "Francisco Fiedler",
  },
];

export async function getMyOpportunities(): Promise<OpportunityRow[]> {
  const session = await requireSession();
  const email = session.user?.email;

  if (!email) {
    throw new Error("No email found on session.");
  }

  if (flags.useMockSalesforce) {
    return MOCK_OPPORTUNITIES;
  }

  try {
    return await cached(
      async () => {
        const records = await getOpportunitiesByOwnerEmail(email);
        return records.map(mapOpportunity);
      },
      `my-opportunities:${email}`,
      { revalidate: 120, tags: ["opportunities"] },
    );
  } catch (err) {
    console.error("[getMyOpportunities] error:", err);
    return [];
  }
}

const MOCK_DASHBOARD_OPPORTUNITIES: OpportunityRow[] = [
  ...MOCK_OPPORTUNITIES,
  {
    id: "006MOCK004",
    name: "GlobalTech - Platform License",
    accountName: "GlobalTech",
    accountId: "001MOCK004",
    stageName: "Closed Won",
    type: "New",
    amount: 120000,
    closeDate: "2026-01-28",
    createdDate: "2025-11-15T10:00:00Z",
    lastModified: "2026-01-28T16:00:00Z",
    ownerName: "Francisco Fiedler",
  },
  {
    id: "006MOCK005",
    name: "DataFlow - Annual Renewal",
    accountName: "DataFlow Inc",
    accountId: "001MOCK005",
    stageName: "Closed Won",
    type: "Renewal",
    amount: 36000,
    closeDate: "2026-02-10",
    createdDate: "2025-12-20T09:00:00Z",
    lastModified: "2026-02-10T14:30:00Z",
    ownerName: "Jane Smith",
  },
  {
    id: "006MOCK006",
    name: "Pinnacle Corp - Expansion",
    accountName: "Pinnacle Corp",
    accountId: "001MOCK006",
    stageName: "Closed Won",
    type: "Expansion",
    amount: 85000,
    closeDate: "2026-02-05",
    createdDate: "2026-01-02T08:00:00Z",
    lastModified: "2026-02-05T11:00:00Z",
    ownerName: "Francisco Fiedler",
  },
  {
    id: "006MOCK007",
    name: "Nexus Media - Starter Plan",
    accountName: "Nexus Media",
    accountId: "001MOCK007",
    stageName: "Closed Lost",
    type: "New",
    amount: 8000,
    closeDate: "2026-01-15",
    createdDate: "2025-12-01T12:00:00Z",
    lastModified: "2026-01-15T17:00:00Z",
    ownerName: "Jane Smith",
  },
  {
    id: "006MOCK008",
    name: "CloudSync - Enterprise",
    accountName: "CloudSync",
    accountId: "001MOCK008",
    stageName: "Customer Evaluation",
    type: "Amendment",
    amount: 64000,
    closeDate: "2026-05-15",
    createdDate: "2026-02-12T10:00:00Z",
    lastModified: "2026-02-20T09:00:00Z",
    ownerName: "Francisco Fiedler",
  },
];

export async function getDashboardOpportunities(): Promise<OpportunityRow[]> {
  await requireSession();

  if (flags.useMockSalesforce) {
    return MOCK_DASHBOARD_OPPORTUNITIES;
  }

  return cached(
    async () => {
      const yearStart = `${new Date().getFullYear()}-01-01`;
      const records = await getOpportunitiesForDashboard(yearStart);
      return records.map(mapOpportunity);
    },
    "dashboard-opportunities",
    { revalidate: 120, tags: ["opportunities"] },
  );
}

export async function getAllOpportunitiesAdmin(): Promise<OpportunityRow[]> {
  const session = await requireSession();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") {
    throw new Error("Forbidden: admin access required.");
  }

  if (flags.useMockSalesforce) {
    return MOCK_OPPORTUNITIES;
  }

  return cached(
    async () => {
      const records = await getAllOpportunities();
      return records.map(mapOpportunity);
    },
    "all-opportunities-admin",
    { revalidate: 120, tags: ["opportunities"] },
  );
}

function mapOpportunity(r: {
  Id: string;
  Name: string;
  StageName: string;
  CloseDate: string;
  CreatedDate: string;
  Amount: number | null;
  Type: string | null;
  LastModifiedDate: string;
  Account: { Id: string; Name: string } | null;
  Owner: { Name: string } | null;
}): OpportunityRow {
  return {
    id: r.Id,
    name: r.Name,
    accountName: r.Account?.Name ?? null,
    accountId: r.Account?.Id ?? null,
    stageName: r.StageName,
    type: r.Type ?? null,
    amount: r.Amount,
    closeDate: r.CloseDate,
    createdDate: r.CreatedDate,
    lastModified: r.LastModifiedDate,
    ownerName: r.Owner?.Name ?? null,
  };
}

export async function searchSalesforceAccounts(
  term: string,
): Promise<{ id: string; name: string; industry: string | null }[]> {
  await requireSession();

  if (!term || term.trim().length < 2) return [];

  if (flags.useMockSalesforce) {
    const mocks = [
      { id: "001MOCK001", name: "Acme Corp", industry: "Technology" },
      { id: "001MOCK002", name: "Widget Inc", industry: "Manufacturing" },
      { id: "001MOCK003", name: "TechCo", industry: "Technology" },
      { id: "001MOCK004", name: "Alpha Solutions", industry: "Consulting" },
    ];
    return mocks.filter((m) =>
      m.name.toLowerCase().includes(term.toLowerCase()),
    );
  }

  try {
    const records = await searchAccounts(term.trim());
    return (records as { Id: string; Name: string; Industry: string | null }[]).map(
      (r) => ({
        id: r.Id,
        name: r.Name,
        industry: r.Industry ?? null,
      }),
    );
  } catch (err) {
    console.error("[searchSalesforceAccounts] error:", err);
    return [];
  }
}

export async function getOpportunitiesForAccount(
  sfAccountId: string,
  quoteType?: string,
): Promise<OpportunityRow[]> {
  await requireSession();

  if (!sfAccountId) return [];

  if (flags.useMockSalesforce) {
    const all = MOCK_DASHBOARD_OPPORTUNITIES.filter(
      (o) => o.accountId === sfAccountId,
    );
    if (quoteType) return all.filter((o) => o.type === quoteType);
    return all;
  }

  try {
    const records = await getOpportunitiesByAccountId(sfAccountId);
    let rows = records.map(mapOpportunity);
    if (quoteType) {
      rows = rows.filter((r) => r.type === quoteType);
    }
    return rows;
  } catch (err) {
    console.error("[getOpportunitiesForAccount] error:", err);
    return [];
  }
}

export async function getOpportunityStages(): Promise<string[]> {
  return [
    "Discovery & Qualification",
    "Customer Evaluation",
    "Pricing & Negotiation",
    "Contract Sent",
    "Closed Won",
    "Closed Lost",
  ];
}
