"use server";

import { prisma } from "@omnibridge/db";
import { getStripeClient } from "@omnibridge/stripe";
import { updateSObject, soql, escapeSoql } from "@omnibridge/salesforce";
import { createSfQuoteEvent } from "@/lib/actions/sf-quote-event";

/**
 * Shared logic for finalizing quote acceptance after checkout or invoice payment.
 * Handles: status update, subscription backfill, schedule conversion, SF sync, audit log.
 * Guards against duplicate SF contract creation via `sfContractId` check.
 */
export async function finalizeQuoteAcceptance(
  recordId: string,
  opts: {
    subscriptionId?: string;
    triggeredBy: "checkout" | "invoice";
    checkoutSessionId?: string;
    invoiceId?: string;
    amountPaid?: number;
  },
) {
  const record = await prisma.quoteRecord.findUnique({
    where: { id: recordId },
  });
  if (!record || record.dryRun) return;

  // Already fully processed — skip
  if (record.status === "accepted" && record.sfContractId) {
    console.log(
      `[finalizeQuoteAcceptance] Record ${recordId} already fully processed — skipping`,
    );
    return;
  }

  // Mark accepted
  if (record.status !== "accepted") {
    await prisma.quoteRecord.update({
      where: { id: recordId },
      data: { status: "accepted", acceptedAt: new Date() },
    });
  }

  const { subscriptionId, triggeredBy } = opts;

  // Backfill subscription data and create schedule
  if (subscriptionId) {
    await backfillSubscriptionData(record, subscriptionId);

    const { computeIterations } = await import("@/lib/billing-utils");
    type ContractTerm = import("@/lib/billing-utils").ContractTerm;
    type BillingFrequency = import("@/lib/billing-utils").BillingFrequency;

    if (
      record.contractTerm &&
      record.contractTerm !== "mtm" &&
      record.billingFrequency &&
      !record.stripeScheduleId
    ) {
      await convertToSubscriptionSchedule(
        record,
        subscriptionId,
        computeIterations,
      );
    }
  }

  // SF sync
  if (record.sfQuoteId && subscriptionId) {
    await syncToSalesforce(record, subscriptionId, opts);
  }

  // Push SF quote number to Stripe metadata
  if (record.sfQuoteNumber) {
    try {
      const stripe = getStripeClient();
      await stripe.quotes.update(record.stripeQuoteId, {
        metadata: { sf_quote_number: record.sfQuoteNumber },
      });
    } catch (err) {
      console.error(
        "[finalizeQuoteAcceptance] Failed to push sf_quote_number:",
        err,
      );
    }
  }

  // Audit log
  const auditAction =
    triggeredBy === "checkout"
      ? "quote.accepted_via_checkout"
      : "quote.invoice_paid";
  await prisma.auditLog.create({
    data: {
      action: auditAction,
      targetType: "stripe_quote",
      targetId: record.stripeQuoteId,
      payloadJson: {
        quoteRecordId: recordId,
        ...(opts.checkoutSessionId
          ? { checkoutSessionId: opts.checkoutSessionId }
          : {}),
        ...(opts.invoiceId ? { invoiceId: opts.invoiceId } : {}),
        ...(opts.amountPaid != null ? { amountPaid: opts.amountPaid } : {}),
        subscriptionId: subscriptionId ?? null,
      },
    },
  });

  // SF timeline event (fire-and-forget)
  if (record.sfQuoteId) {
    const sfAction =
      triggeredBy === "checkout" ? "quote.accepted" : "invoice.paid";
    createSfQuoteEvent({
      sfQuoteId: record.sfQuoteId,
      action: sfAction,
      occurredAt: new Date(),
      source: "stripe",
      details: {
        ...(opts.checkoutSessionId
          ? { checkoutSessionId: opts.checkoutSessionId }
          : {}),
        ...(opts.invoiceId ? { invoiceId: opts.invoiceId } : {}),
        ...(opts.amountPaid != null ? { amountPaid: opts.amountPaid } : {}),
        subscriptionId: subscriptionId ?? null,
      },
    }).catch((err) =>
      console.error(`[SF Event] ${sfAction} failed:`, err),
    );
  }
}

async function backfillSubscriptionData(
  record: { id: string; stripeQuoteId: string },
  subscriptionId: string,
) {
  try {
    const stripe = getStripeClient();
    const sub = await stripe.subscriptions.retrieve(subscriptionId);
    const subItemIds = sub.items.data.map((item) => item.id);

    await prisma.quoteRecord.update({
      where: { id: record.id },
      data: {
        stripeSubscriptionId: subscriptionId,
        stripeSubItemIds: subItemIds,
      },
    });

    console.log(
      `[finalizeQuoteAcceptance] Backfilled subscription ${subscriptionId} (${subItemIds.length} items) on quote ${record.stripeQuoteId}`,
    );
  } catch (err) {
    console.error(
      "[finalizeQuoteAcceptance] Failed to backfill subscription data:",
      err,
    );
  }
}

async function convertToSubscriptionSchedule(
  record: {
    id: string;
    stripeQuoteId: string;
    contractTerm: string | null;
    billingFrequency: string | null;
  },
  subscriptionId: string,
  computeIterations: (
    contractTerm: import("@/lib/billing-utils").ContractTerm,
    billingFrequency: import("@/lib/billing-utils").BillingFrequency,
  ) => number,
) {
  try {
    const stripe = getStripeClient();

    type ContractTerm = import("@/lib/billing-utils").ContractTerm;
    type BillingFrequency = import("@/lib/billing-utils").BillingFrequency;

    const iterations = computeIterations(
      record.contractTerm as ContractTerm,
      record.billingFrequency as BillingFrequency,
    );

    const schedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscriptionId,
    } as any);

    const currentPhase = schedule.phases[0];
    if (currentPhase) {
      await stripe.subscriptionSchedules.update(schedule.id, {
        end_behavior: "release",
        phases: [
          {
            items: currentPhase.items.map((item: any) => ({
              price: item.price,
              quantity: item.quantity,
            })),
            iterations,
          },
        ],
      } as any);
    }

    await prisma.quoteRecord.update({
      where: { id: record.id },
      data: { stripeScheduleId: schedule.id },
    });

    await prisma.auditLog.create({
      data: {
        action: "subscription.schedule_created",
        targetType: "stripe_subscription_schedule",
        targetId: schedule.id,
        payloadJson: {
          quoteRecordId: record.id,
          subscriptionId,
          contractTerm: record.contractTerm,
          billingFrequency: record.billingFrequency,
          iterations,
          endBehavior: "release",
        },
      },
    });

    console.log(
      `[finalizeQuoteAcceptance] Created subscription schedule ${schedule.id} for quote ${record.stripeQuoteId} (${iterations} iterations)`,
    );
  } catch (err) {
    console.error(
      "[finalizeQuoteAcceptance] Failed to create subscription schedule:",
      err,
    );
  }
}

async function syncToSalesforce(
  record: Awaited<ReturnType<typeof prisma.quoteRecord.findUnique>> & {},
  subscriptionId: string,
  opts: {
    invoiceId?: string;
  },
) {
  if (!record.sfQuoteId) return;

  try {
    const { updateSfQuoteStatus, closeOpportunityWon } = await import(
      "@/lib/actions/sf-quote-mirror"
    );
    const { createSfRecordsFromQuote } = await import(
      "@/lib/actions/sf-contract-from-quote"
    );

    if (record.sfAccountId) {
      // Guard against duplicate SF contract creation
      const fresh = await prisma.quoteRecord.findUnique({
        where: { id: record.id },
      });

      if (fresh?.sfContractId) {
        console.log(
          "[finalizeQuoteAcceptance] SF Contract already exists, skipping duplicate creation",
        );
      } else {
        const sfResult = await createSfRecordsFromQuote(
          record,
          subscriptionId,
          new Date(),
          false,
        );

        sfResult.log.forEach((l: string) => console.log(l));

        if (sfResult.success && sfResult.contractId) {
          try {
            const stripe = getStripeClient();
            await stripe.quotes.update(record.stripeQuoteId, {
              metadata: { sf_contract_id: sfResult.contractId },
            });
          } catch (err) {
            console.error(
              "[finalizeQuoteAcceptance] Failed to push sf_contract_id to Stripe:",
              err,
            );
          }
          console.log(
            `[finalizeQuoteAcceptance] Created SF Contract: ${sfResult.contractId} with ${sfResult.subscriptionIds?.length || 0} subscriptions`,
          );
        } else {
          console.error(
            `[finalizeQuoteAcceptance] Failed to create SF records: ${sfResult.error}`,
          );
        }
      }

      await updateSObject("Stripe_Quote__c", record.sfQuoteId, {
        Stripe_Subscription_ID__c: subscriptionId,
        Is_Payment_Done__c: true,
      });
    }

    await updateSfQuoteStatus(record.sfQuoteId, "Accepted", false);

    if (record.opportunityId) {
      await closeOpportunityWon(
        record.opportunityId,
        record.totalAmount ?? 0,
        false,
      );
    }

    // Link invoice to SF quote if applicable
    if (opts.invoiceId) {
      await linkInvoiceToStripeQuote(record.sfQuoteId, opts.invoiceId);
    }
  } catch (err) {
    console.error("[finalizeQuoteAcceptance] SF sync error:", err);
  }
}

async function linkInvoiceToStripeQuote(
  sfQuoteId: string,
  stripeInvoiceId: string,
) {
  try {
    const result = await soql<{ Id: string }>(
      `SELECT Id FROM Stripe_Invoice__c WHERE Stripe_Invoice_Id__c = '${escapeSoql(stripeInvoiceId)}' LIMIT 1`,
    );
    if (result.length > 0) {
      const sfInvoiceId = result[0]!.Id;
      await updateSObject("Stripe_Invoice__c", sfInvoiceId, {
        Stripe_Quote__c: sfQuoteId,
      });
      console.log(
        `[finalizeQuoteAcceptance] Linked Stripe_Invoice__c ${sfInvoiceId} → Stripe_Quote__c ${sfQuoteId}`,
      );
    }
  } catch (err) {
    console.error(
      "[finalizeQuoteAcceptance] Failed to link invoice to Stripe Quote:",
      err,
    );
  }
}
