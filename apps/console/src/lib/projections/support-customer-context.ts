"use server";

import { requireSession } from "@omnibridge/auth";
import { prisma } from "@omnibridge/db";
import { formatMoney, formatRenewalDate } from "@/lib/support/format";

type SupportCustomerContextInput = {
  key: string;
  customerIndexId: string | null;
  stripeCustomerId: string | null;
};

type RenewalOwner = {
  name: string | null;
  email: string | null;
};

export type SupportCustomerContext = {
  mrr: string;
  billing: string;
  renewal: string;
  renewalOwner: RenewalOwner | null;
};

const UNLINKED_CONTEXT: SupportCustomerContext = {
  mrr: "Unlinked",
  billing: "No billing link",
  renewal: "No renewal",
  renewalOwner: null,
};

export async function getSupportCustomerContexts(
  inputs: SupportCustomerContextInput[],
): Promise<Map<string, SupportCustomerContext>> {
  await requireSession();

  const customerIndexIds = [...new Set(
    inputs
      .map((input) => input.customerIndexId)
      .filter((value): value is string => Boolean(value)),
  )];
  const stripeCustomerIds = [...new Set(
    inputs
      .map((input) => input.stripeCustomerId)
      .filter((value): value is string => Boolean(value)),
  )];

  const [renewals, invoices, activeItems] = await Promise.all([
    customerIndexIds.length > 0
      ? prisma.renewal.findMany({
          where: { customerIndexId: { in: customerIndexIds } },
          orderBy: [{ customerIndexId: "asc" }, { targetRenewalDate: "asc" }],
          select: {
            customerIndexId: true,
            targetRenewalDate: true,
            owner: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        })
      : [],
    stripeCustomerIds.length > 0
      ? prisma.stripeInvoice.findMany({
          where: {
            customerId: { in: stripeCustomerIds },
            status: { in: ["open", "uncollectible"] },
          },
          select: {
            customerId: true,
            status: true,
            amountDue: true,
          },
        })
      : [],
    stripeCustomerIds.length > 0
      ? prisma.stripeSubscriptionItem.findMany({
          where: {
            customerId: { in: stripeCustomerIds },
            subscription: {
              status: { in: ["active", "past_due", "trialing"] },
            },
          },
          select: {
            customerId: true,
            unitAmount: true,
            quantity: true,
          },
        })
      : [],
  ]);

  const renewalByCustomerIndexId = new Map<
    string,
    { targetRenewalDate: Date; owner: RenewalOwner | null }
  >();
  for (const renewal of renewals) {
    if (renewalByCustomerIndexId.has(renewal.customerIndexId)) continue;
    renewalByCustomerIndexId.set(renewal.customerIndexId, {
      targetRenewalDate: renewal.targetRenewalDate,
      owner: renewal.owner
        ? {
            name: renewal.owner.name,
            email: renewal.owner.email,
          }
        : null,
    });
  }

  const invoiceSummaryByStripeCustomerId = new Map<
    string,
    { invoiceCount: number; openCount: number }
  >();
  for (const invoice of invoices) {
    if (!invoice.customerId) continue;
    const current = invoiceSummaryByStripeCustomerId.get(invoice.customerId) ?? {
      invoiceCount: 0,
      openCount: 0,
    };
    current.invoiceCount += 1;
    if (invoice.status === "open") current.openCount += 1;
    invoiceSummaryByStripeCustomerId.set(invoice.customerId, current);
  }

  const mrrAmountByStripeCustomerId = new Map<string, number>();
  for (const item of activeItems) {
    if (!item.customerId) continue;
    const current = mrrAmountByStripeCustomerId.get(item.customerId) ?? 0;
    mrrAmountByStripeCustomerId.set(
      item.customerId,
      current + item.unitAmount * item.quantity,
    );
  }

  const contexts = new Map<string, SupportCustomerContext>();
  for (const input of inputs) {
    if (!input.customerIndexId && !input.stripeCustomerId) {
      contexts.set(input.key, UNLINKED_CONTEXT);
      continue;
    }

    const renewal = input.customerIndexId
      ? renewalByCustomerIndexId.get(input.customerIndexId)
      : null;
    const invoiceSummary = input.stripeCustomerId
      ? invoiceSummaryByStripeCustomerId.get(input.stripeCustomerId)
      : null;
    const mrrAmount = input.stripeCustomerId
      ? mrrAmountByStripeCustomerId.get(input.stripeCustomerId) ?? 0
      : 0;

    contexts.set(input.key, {
      mrr: formatMoney(mrrAmount / 100),
      billing: invoiceSummary
        ? `${invoiceSummary.openCount} open · ${invoiceSummary.invoiceCount} total`
        : "Billing healthy",
      renewal: formatRenewalDate(renewal?.targetRenewalDate),
      renewalOwner: renewal?.owner ?? null,
    });
  }

  return contexts;
}
