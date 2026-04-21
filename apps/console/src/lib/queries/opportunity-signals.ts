"use server";

import { requireSession } from "@omnibridge/auth";
import { getOpportunitiesByOwnerEmail } from "@omnibridge/salesforce";
import { flags } from "@/lib/feature-flags";

export interface MyOpportunitySignals {
  totalOpen: number;
  openPipelineValue: number;
  closedWonYtd: number;
  closedWonRevenue: number;
  overdueCount: number;
  avgDealSize: number;
}

export async function getMyOpportunitySignals(): Promise<MyOpportunitySignals> {
  const session = await requireSession();
  const email = session.user?.email;
  if (!email) throw new Error("No email on session");

  if (flags.useMockSalesforce) {
    return {
      totalOpen: 5,
      openPipelineValue: 172000,
      closedWonYtd: 8,
      closedWonRevenue: 341000,
      overdueCount: 1,
      avgDealSize: 42625,
    };
  }

  try {
    const records = await getOpportunitiesByOwnerEmail(email);

    const currentYear = new Date().getFullYear();
    const yearStart = `${currentYear}-01-01`;
    const now = new Date();

    let totalOpen = 0;
    let openPipelineValue = 0;
    let closedWonYtd = 0;
    let closedWonRevenue = 0;
    let overdueCount = 0;

    for (const r of records) {
      const stage = r.StageName;
      const amount = r.Amount ?? 0;
      const closeDate = r.CloseDate;
      const isClosed = stage === "Closed Won" || stage === "Closed Lost";

      if (!isClosed) {
        totalOpen++;
        openPipelineValue += amount;
        if (closeDate && new Date(closeDate) < now) {
          overdueCount++;
        }
      }

      if (stage === "Closed Won" && closeDate >= yearStart) {
        closedWonYtd++;
        closedWonRevenue += amount;
      }
    }

    return {
      totalOpen,
      openPipelineValue,
      closedWonYtd,
      closedWonRevenue,
      overdueCount,
      avgDealSize: closedWonYtd > 0 ? closedWonRevenue / closedWonYtd : 0,
    };
  } catch (err) {
    console.error("[getMyOpportunitySignals]", err);
    return {
      totalOpen: 0,
      openPipelineValue: 0,
      closedWonYtd: 0,
      closedWonRevenue: 0,
      overdueCount: 0,
      avgDealSize: 0,
    };
  }
}
