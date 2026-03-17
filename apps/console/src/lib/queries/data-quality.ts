"use server";

import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";

export interface DataQualityReport {
  accounts: {
    total: number;
    stubs: number;
    hydrated: number;
  };
  contracts: {
    total: number;
    withLines: number;
    withoutLines: number;
    withDates: number;
    missingDates: number;
    withTerm: number;
    missingTerm: number;
    statusDistribution: { status: string; count: number }[];
  };
  contractLines: {
    total: number;
    withParent: number;
    orphaned: number;
  };
  stripeLinkage: {
    contractsWithSub: number;
    contractsWithoutSub: number;
    validLinks: number;
    brokenLinks: number;
  };
  omniLinkage: {
    quoteRecordsWithContract: number;
    contractsLinkedFromQuote: number;
  };
  invoiceCoverage: {
    customersTotal: number;
    customersWithInvoices: number;
  };
  paymentMethodCoverage: {
    customersTotal: number;
    customersWithPm: number;
  };
}

export async function getDataQualityReport(): Promise<DataQualityReport> {
  await requireSession();

  const [
    accountTotal,
    stubAccounts,
    hydratedAccounts,
    contractTotal,
    contractsWithLines,
    contractsWithDates,
    contractsWithTerm,
    contractsWithSub,
    lineTotal,
    linesWithParent,
    quoteRecordsWithContract,
    contractsLinkedFromQuote,
    statusDist,
    validStripeLinks,
    // New coverage metrics
    customerTotal,
    customersWithInvoices,
    customersWithPm,
  ] = await Promise.all([
    prisma.sfAccount.count(),
    prisma.sfAccount.count({ where: { isStub: true } }),
    prisma.sfAccount.count({ where: { hydratedAt: { not: null } } }),
    prisma.sfContract.count(),
    prisma.$queryRaw<[{ cnt: number }]>`
      SELECT COUNT(DISTINCT c.id)::int AS cnt
      FROM sf_contracts c
      JOIN sf_contract_lines l ON l.contract_id = c.id
    `.then((r) => r[0]?.cnt ?? 0),
    prisma.sfContract.count({ where: { startDate: { not: null }, endDate: { not: null } } }),
    prisma.sfContract.count({ where: { contractTerm: { not: null } } }),
    prisma.sfContract.count({ where: { stripeSubscriptionId: { not: null } } }),
    prisma.sfContractLine.count(),
    prisma.$queryRaw<[{ cnt: number }]>`
      SELECT COUNT(*)::int AS cnt
      FROM sf_contract_lines l
      WHERE EXISTS (SELECT 1 FROM sf_contracts c WHERE c.id = l.contract_id)
    `.then((r) => r[0]?.cnt ?? 0),
    prisma.quoteRecord.count({ where: { sfContractId: { not: null } } }),
    prisma.$queryRaw<[{ cnt: number }]>`
      SELECT COUNT(DISTINCT q.sf_contract_id)::int AS cnt
      FROM quote_records q
      WHERE q.sf_contract_id IS NOT NULL
    `.then((r) => r[0]?.cnt ?? 0),
    prisma.$queryRaw<{ status: string; cnt: number }[]>`
      SELECT status, COUNT(*)::int AS cnt
      FROM sf_contracts
      GROUP BY status
      ORDER BY cnt DESC
    `,
    prisma.$queryRaw<[{ cnt: number }]>`
      SELECT COUNT(*)::int AS cnt
      FROM sf_contracts c
      WHERE c.stripe_subscription_id IS NOT NULL
      AND EXISTS (SELECT 1 FROM stripe_subscriptions s WHERE s.id = c.stripe_subscription_id)
    `.then((r) => r[0]?.cnt ?? 0),
    // Invoice & payment method coverage
    prisma.stripeCustomer.count(),
    prisma.$queryRaw<[{ cnt: number }]>`
      SELECT COUNT(DISTINCT i.customer_id)::int AS cnt
      FROM stripe_invoices i
    `.then((r) => r[0]?.cnt ?? 0),
    prisma.$queryRaw<[{ cnt: number }]>`
      SELECT COUNT(DISTINCT pm.customer_id)::int AS cnt
      FROM stripe_payment_methods pm
      WHERE pm.customer_id IS NOT NULL
    `.then((r) => r[0]?.cnt ?? 0),
  ]);

  return {
    accounts: {
      total: accountTotal,
      stubs: stubAccounts,
      hydrated: hydratedAccounts,
    },
    contracts: {
      total: contractTotal,
      withLines: contractsWithLines,
      withoutLines: contractTotal - contractsWithLines,
      withDates: contractsWithDates,
      missingDates: contractTotal - contractsWithDates,
      withTerm: contractsWithTerm,
      missingTerm: contractTotal - contractsWithTerm,
      statusDistribution: statusDist.map((s) => ({ status: s.status, count: s.cnt })),
    },
    contractLines: {
      total: lineTotal,
      withParent: linesWithParent,
      orphaned: lineTotal - linesWithParent,
    },
    stripeLinkage: {
      contractsWithSub: contractsWithSub,
      contractsWithoutSub: contractTotal - contractsWithSub,
      validLinks: validStripeLinks,
      brokenLinks: contractsWithSub - validStripeLinks,
    },
    omniLinkage: {
      quoteRecordsWithContract: quoteRecordsWithContract,
      contractsLinkedFromQuote: contractsLinkedFromQuote,
    },
    invoiceCoverage: {
      customersTotal: customerTotal,
      customersWithInvoices: customersWithInvoices,
    },
    paymentMethodCoverage: {
      customersTotal: customerTotal,
      customersWithPm: customersWithPm,
    },
  };
}
