"use server";

import { requireSession } from "@omnibridge/auth";
import { prisma } from "@omnibridge/db";
import { flags } from "@/lib/feature-flags";
import { getAccountDetailById } from "@/lib/queries/customers";
import { getStripeCustomerDetail } from "@/lib/queries/stripe-customer-detail";
import type { AccountDetail } from "@/lib/queries/customers";
import type { StripeCustomerDetail } from "@/lib/queries/stripe-customer-detail";

export interface CustomerSearchResult {
  id: string;
  name: string;
  email: string | null;
  domain: string | null;
  sfAccountId: string | null;
  stripeCustomerId: string | null;
  source: "local" | "salesforce" | "stripe";
}

export async function searchCustomersTypeahead(
  query: string,
): Promise<CustomerSearchResult[]> {
  await requireSession();
  if (!query || query.length < 2) return [];

  const seen = new Set<string>();
  const results: CustomerSearchResult[] = [];

  // 1. Local DB (fast)
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
    take: 10,
  });

  for (const r of dbResults) {
    const key = r.sfAccountId ?? r.stripeCustomerId ?? r.id;
    seen.add(key);
    results.push({
      id: r.id,
      name: r.sfAccountName ?? r.stripeCustomerId ?? r.id,
      email: null,
      domain: r.domain,
      sfAccountId: r.sfAccountId,
      stripeCustomerId: r.stripeCustomerId,
      source: "local",
    });
  }

  // 2. Salesforce + Stripe in parallel
  const [sfResults, stripeResults] = await Promise.all([
    searchSalesforceTypeahead(query),
    searchStripeTypeahead(query),
  ]);

  for (const a of sfResults) {
    if (a.sfAccountId && seen.has(a.sfAccountId)) continue;
    if (a.sfAccountId) seen.add(a.sfAccountId);
    results.push(a);
  }

  for (const s of stripeResults) {
    if (s.stripeCustomerId && seen.has(s.stripeCustomerId)) continue;
    if (s.stripeCustomerId) seen.add(s.stripeCustomerId);
    results.push(s);
  }

  return results.slice(0, 15);
}

async function searchSalesforceTypeahead(
  query: string,
): Promise<CustomerSearchResult[]> {
  if (flags.useMockSalesforce) return [];

  try {
    const { searchAccounts } = await import("@omnibridge/salesforce");
    const accounts = (await searchAccounts(query)) as {
      Id: string;
      Name: string;
      Website: string | null;
    }[];

    return accounts.slice(0, 10).map((a) => ({
      id: `sf_${a.Id}`,
      name: a.Name,
      email: null,
      domain: a.Website
        ? new URL(
            a.Website.startsWith("http") ? a.Website : `https://${a.Website}`,
          ).hostname.replace(/^www\./, "")
        : null,
      sfAccountId: a.Id,
      stripeCustomerId: null,
      source: "salesforce" as const,
    }));
  } catch (err) {
    console.error("[searchSalesforceTypeahead]", err);
    return [];
  }
}

async function searchStripeTypeahead(
  query: string,
): Promise<CustomerSearchResult[]> {
  if (flags.useMockStripe) return [];

  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();
    const result = await stripe.customers.search({
      query: `name~"${query}" OR email~"${query}"`,
      limit: 10,
    });

    return result.data.map((c) => ({
      id: `stripe_${c.id}`,
      name: c.name ?? c.email ?? c.id,
      email: c.email ?? null,
      domain: null,
      sfAccountId: null,
      stripeCustomerId: c.id,
      source: "stripe" as const,
    }));
  } catch (err) {
    console.error("[searchStripeTypeahead]", err);
    return [];
  }
}

export interface CustomerPanelData {
  sfAccount: AccountDetail | null;
  stripeDetail: StripeCustomerDetail | null;
  sfUrl: string | null;
  stripeUrl: string | null;
}

export async function getCustomerPanelData(
  sfAccountId: string | null,
  stripeCustomerId: string | null,
): Promise<CustomerPanelData> {
  await requireSession();

  const sfBase =
    process.env.NEXT_PUBLIC_SF_ORG_URL ??
    "https://raydiant.lightning.force.com";

  // Fetch SF account first (may contain Stripe Customer ID we don't have yet)
  const sfAccount = sfAccountId
    ? await getAccountDetailById(sfAccountId).catch(() => null)
    : null;

  // Resolve Stripe customer ID: use explicit param, fall back to SF account field
  const resolvedStripeId = stripeCustomerId ?? sfAccount?.stripeCustomerId ?? null;

  const stripeDetail = resolvedStripeId
    ? await getStripeCustomerDetail(resolvedStripeId).catch(() => null)
    : null;

  return {
    sfAccount,
    stripeDetail,
    sfUrl: sfAccountId
      ? `${sfBase}/lightning/r/Account/${sfAccountId}/view`
      : null,
    stripeUrl: resolvedStripeId
      ? `https://dashboard.stripe.com/customers/${resolvedStripeId}`
      : null,
  };
}
