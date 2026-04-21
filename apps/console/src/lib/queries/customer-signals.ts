"use server";

// ⚠️  DEPRECATED — do not add new signal queries here.
// New customer signal reads belong in lib/projections/ using CustomerView or a dedicated SignalView.
// This file will be removed once the 360 page is wired to the projection layer.

import { requireSession } from "@omnibridge/auth";
import { prisma } from "@omnibridge/db";
import { soql } from "@omnibridge/salesforce";
import { flags } from "@/lib/feature-flags";

export interface PortfolioSignals {
  activeSfAccounts: number;
  activeStripeCustomers: number;
  totalMrr: number;
  totalArr: number;
  activeSubscriptions: number;
  activeContracts: number;
}

export async function getPortfolioSignals(): Promise<PortfolioSignals> {
  await requireSession();

  const [sfCounts, stripeCounts] = await Promise.all([
    getSalesforceCounts(),
    getStripeCounts(),
  ]);

  return {
    ...sfCounts,
    ...stripeCounts,
  };
}

async function getSalesforceCounts(): Promise<{
  activeSfAccounts: number;
  totalMrr: number;
  totalArr: number;
  activeContracts: number;
}> {
  if (flags.useMockSalesforce) {
    return {
      activeSfAccounts: 42,
      totalMrr: 128500,
      totalArr: 1542000,
      activeContracts: 38,
    };
  }

  try {
    const [accountResult, contractResult] = await Promise.all([
      soql<{
        activeCount: number;
        mrrTotal: number;
        arrTotal: number;
      }>(
        `SELECT COUNT(Id) activeCount, SUM(Account_Value__c) mrrTotal, SUM(Total_ARR__c) arrTotal FROM Account WHERE Status_Calculated__c = 'Active Customer'`,
      ),
      soql<{ contractCount: number }>(
        `SELECT COUNT(Id) contractCount FROM Contract WHERE Status = 'Activated'`,
      ).catch(() => [{ contractCount: 0 }]),
    ]);

    const acc = accountResult[0] ?? { activeCount: 0, mrrTotal: 0, arrTotal: 0 };
    const con = contractResult[0] ?? { contractCount: 0 };

    return {
      activeSfAccounts: acc.activeCount ?? 0,
      totalMrr: acc.mrrTotal ?? 0,
      totalArr: acc.arrTotal ?? 0,
      activeContracts: con.contractCount ?? 0,
    };
  } catch (err) {
    console.error("[getSalesforceCounts]", err);
    return { activeSfAccounts: 0, totalMrr: 0, totalArr: 0, activeContracts: 0 };
  }
}

async function getStripeCounts(): Promise<{
  activeStripeCustomers: number;
  activeSubscriptions: number;
}> {
  // Use local mirror table for fast counts
  try {
    const [subCount, customerCount] = await Promise.all([
      prisma.stripeSubscription.count({
        where: { status: "active" },
      }),
      prisma.stripeSubscription.groupBy({
        by: ["customerId"],
        where: { status: "active" },
      }).then((groups) => groups.length),
    ]);

    return {
      activeStripeCustomers: customerCount,
      activeSubscriptions: subCount,
    };
  } catch (err) {
    console.error("[getStripeCounts]", err);
    return { activeStripeCustomers: 0, activeSubscriptions: 0 };
  }
}
