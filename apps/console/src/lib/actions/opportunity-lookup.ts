"use server";

import { requireSession } from "@omnibridge/auth";
import { getAccountDetailById } from "@/lib/queries/customers";
import { getOpportunitiesForAccount } from "@/lib/queries/opportunities";
import type { AccountDetail } from "@/lib/queries/customers";
import type { OpportunityRow } from "@/lib/queries/opportunities";

export interface OpportunityPanelData {
  sfAccount: AccountDetail | null;
  opportunities: OpportunityRow[];
  sfUrl: string | null;
}

export async function getOpportunityPanelData(
  sfAccountId: string | null,
): Promise<OpportunityPanelData> {
  await requireSession();

  if (!sfAccountId) {
    return { sfAccount: null, opportunities: [], sfUrl: null };
  }

  const sfBase =
    process.env.NEXT_PUBLIC_SF_ORG_URL ??
    "https://raydiant.lightning.force.com";

  const [sfAccount, opportunities] = await Promise.all([
    getAccountDetailById(sfAccountId).catch(() => null),
    getOpportunitiesForAccount(sfAccountId).catch(() => []),
  ]);

  return {
    sfAccount,
    opportunities,
    sfUrl: `${sfBase}/lightning/r/Account/${sfAccountId}/view`,
  };
}
