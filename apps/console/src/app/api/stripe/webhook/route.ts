import { NextResponse } from "next/server";
import type { Stripe } from "@omnibridge/stripe";
import { prisma } from "@omnibridge/db";
import { writeProductLog } from "@/lib/product-log";
import type { ProductLogAction } from "@/lib/product-log";
import { computeIterations } from "@/lib/billing-utils";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const { verifyWebhookSignature } = await import("@omnibridge/stripe");
    event = verifyWebhookSignature(body, signature);
  } catch (err) {
    console.error("[Stripe Webhook] Signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const alreadyProcessed = await prisma.productLog.findFirst({
    where: { detail: { path: ["eventId"], equals: event.id } },
  });
  if (alreadyProcessed) {
    return NextResponse.json({ received: true, deduplicated: true });
  }

  const actorEmail = event.request?.id
    ? await resolveStripeRequestUser(event.request.id)
    : null;

  switch (event.type) {
    case "product.created":
      await handleProductEvent("created", event.data.object as Stripe.Product, event, actorEmail);
      break;
    case "product.updated": {
      const prev = (event.data as Stripe.Event.Data & { previous_attributes?: Record<string, unknown> })
        .previous_attributes;
      let action: ProductLogAction = "updated";
      if (prev && "active" in prev) {
        action = (event.data.object as Stripe.Product).active ? "activated" : "deactivated";
      }
      if (await hasRecentOmnibridgeLog((event.data.object as Stripe.Product).id, action)) {
        return NextResponse.json({ received: true, skipped: "omnibridge_logged" });
      }
      await handleProductEvent(action, event.data.object as Stripe.Product, event, actorEmail, prev);
      break;
    }
    case "product.deleted":
      await handleProductEvent("deleted", event.data.object as Stripe.Product, event, actorEmail);
      break;
    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as Record<string, unknown>);
      break;
    case "invoice.paid":
      await handleInvoicePaid(event.data.object as Record<string, unknown>);
      break;
    default:
      break;
  }

  return NextResponse.json({ received: true });
}

interface RequestLogResponse {
  request?: {
    from_dashboard_user?: string;
  };
}

async function resolveStripeRequestUser(requestId: string): Promise<string | null> {
  try {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) return null;
    const res = await fetch(`https://api.stripe.com/v1/request_logs/${requestId}`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as RequestLogResponse;
    return data.request?.from_dashboard_user ?? null;
  } catch {
    return null;
  }
}

async function hasRecentOmnibridgeLog(productId: string, action: string): Promise<boolean> {
  const fiveSecondsAgo = new Date(Date.now() - 5_000);
  const existing = await prisma.productLog.findFirst({
    where: {
      source: "omnibridge",
      action,
      productId,
      createdAt: { gte: fiveSecondsAgo },
    },
  });
  return existing !== null;
}

async function handleProductEvent(
  action: ProductLogAction,
  product: Stripe.Product,
  event: Stripe.Event,
  actorEmail: string | null,
  previousAttributes?: Record<string, unknown>,
) {
  const sfId = product.metadata?.salesforce_product_id
    ?? product.metadata?.sf_product_id
    ?? product.metadata?.SalesforceProductId
    ?? undefined;

  await writeProductLog({
    source: "stripe",
    action,
    productId: product.id,
    productName: product.name,
    actorType: actorEmail ? "user" : "webhook",
    actorId: actorEmail ?? undefined,
    detail: {
      eventId: event.id,
      active: product.active,
      ...(sfId ? { sfProductId: sfId } : {}),
      ...(previousAttributes ? { previousAttributes } : {}),
    },
  });
}

async function handleCheckoutCompleted(session: Record<string, unknown>) {
  const metadata = session.metadata as Record<string, string> | undefined;
  if (metadata?.source !== "displai_omni" || !metadata.quote_record_id) return;

  const recordId = metadata.quote_record_id;
  const record = await prisma.quoteRecord.findUnique({
    where: { id: recordId },
  });
  if (!record || record.dryRun) return;

  await prisma.quoteRecord.update({
    where: { id: recordId },
    data: {
      status: "accepted",
      acceptedAt: new Date(),
    },
  });

  const subscriptionId = (session as any).subscription as string | undefined;
  if (subscriptionId) {
    await backfillSubscriptionData(record, subscriptionId);
    await convertToSubscriptionSchedule(record, subscriptionId);
  }

  if (record.sfQuoteId) {
    try {
      const { updateSfQuoteStatus, closeOpportunityWon } = await import("@/lib/actions/sf-quote-mirror");
      const { createSfRecordsFromQuote } = await import("@/lib/actions/sf-contract-from-quote");

      if (subscriptionId && record.sfAccountId) {
        const fresh = await prisma.quoteRecord.findUnique({
          where: { id: recordId },
        });

        if (fresh?.sfContractId) {
          console.log("[Webhook] SF Contract already exists, skipping duplicate creation");
        } else {
          const sfResult = await createSfRecordsFromQuote(
            record,
            subscriptionId,
            new Date(), // Customer signed date (payment completed)
            false,
          );
          
          sfResult.log.forEach((l) => console.log(l));

          if (sfResult.success && sfResult.contractId) {
            try {
              const { getStripeClient } = await import("@omnibridge/stripe");
              const stripe = getStripeClient();
              await stripe.quotes.update(record.stripeQuoteId, {
                metadata: { sf_contract_id: sfResult.contractId },
              });
            } catch (err) {
              console.error("[Webhook] Failed to push sf_contract_id to Stripe:", err);
            }
            console.log(`[Webhook] Created SF Contract: ${sfResult.contractId} with ${sfResult.subscriptionIds?.length || 0} subscriptions`);
          } else {
            console.error(`[Webhook] Failed to create SF records: ${sfResult.error}`);
          }
        }

        const { updateSObject } = await import("@omnibridge/salesforce");
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
    } catch (err) {
      console.error("[Webhook] SF sync error:", err);
    }
  }

  if (record.sfQuoteNumber) {
    try {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();
      await stripe.quotes.update(record.stripeQuoteId, {
        metadata: { sf_quote_number: record.sfQuoteNumber },
      });
    } catch (err) {
      console.error("[Webhook] Failed to push sf_quote_number to Stripe:", err);
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "quote.accepted_via_checkout",
      targetType: "stripe_quote",
      targetId: record.stripeQuoteId,
      payloadJson: {
        quoteRecordId: recordId,
        checkoutSessionId: session.id,
        subscriptionId: subscriptionId ?? null,
      },
    },
  });
}

async function backfillSubscriptionData(
  record: { id: string; stripeQuoteId: string },
  subscriptionId: string,
) {
  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
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
      `[Webhook] Backfilled subscription ${subscriptionId} (${subItemIds.length} items) on quote ${record.stripeQuoteId}`,
    );
  } catch (err) {
    console.error("[Webhook] Failed to backfill subscription data:", err);
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
) {
  if (
    !record.contractTerm ||
    record.contractTerm === "mtm" ||
    !record.billingFrequency
  ) {
    return;
  }

  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();

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
      `[Webhook] Created subscription schedule ${schedule.id} for quote ${record.stripeQuoteId} (${iterations} iterations, auto-renew)`,
    );
  } catch (err) {
    console.error("[Webhook] Failed to create subscription schedule:", err);
  }
}

async function handleInvoicePaid(invoice: Record<string, unknown>) {
  const metadata = invoice.metadata as Record<string, string> | undefined;

  let stripeQuoteId = metadata?.stripe_quote_id as string | undefined;

  if (!stripeQuoteId) {
    stripeQuoteId = (invoice as any).quote as string | undefined;
  }

  if (!stripeQuoteId) {
    if (metadata?.source !== "displai_omni") return;
    return;
  }

  const record = await prisma.quoteRecord.findUnique({
    where: { stripeQuoteId },
  });
  if (!record || record.dryRun) return;

  if (record.status !== "accepted") {
    await prisma.quoteRecord.update({
      where: { id: record.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });
  }

  const subscriptionId = (invoice as any).subscription as string | undefined;
  if (subscriptionId) {
    await backfillSubscriptionData(record, subscriptionId);
    if (!record.stripeScheduleId) {
      await convertToSubscriptionSchedule(record, subscriptionId);
    }

    if (record.sfQuoteId && record.sfAccountId) {
      try {
        const { updateSfQuoteStatus, closeOpportunityWon } = await import("@/lib/actions/sf-quote-mirror");
        const { createSfRecordsFromQuote } = await import("@/lib/actions/sf-contract-from-quote");

        const fresh = await prisma.quoteRecord.findUnique({
          where: { id: record.id },
        });

        if (fresh?.sfContractId) {
          console.log("[Webhook] SF Contract already exists, skipping duplicate creation");
        } else {
          const sfResult = await createSfRecordsFromQuote(
            record,
            subscriptionId,
            new Date(), // Customer signed date (invoice paid)
            false,
          );
          
          sfResult.log.forEach((l) => console.log(l));

          if (sfResult.success && sfResult.contractId) {
            try {
              const { getStripeClient } = await import("@omnibridge/stripe");
              const stripe = getStripeClient();
              await stripe.quotes.update(record.stripeQuoteId, {
                metadata: { sf_contract_id: sfResult.contractId },
              });
            } catch (err) {
              console.error("[Webhook] Failed to push sf_contract_id to Stripe:", err);
            }
            console.log(`[Webhook] Created SF Contract: ${sfResult.contractId} with ${sfResult.subscriptionIds?.length || 0} subscriptions`);
          } else {
            console.error(`[Webhook] Failed to create SF records: ${sfResult.error}`);
          }
        }

        const { updateSObject } = await import("@omnibridge/salesforce");
        await updateSObject("Stripe_Quote__c", record.sfQuoteId, {
          Stripe_Subscription_ID__c: subscriptionId,
          Is_Payment_Done__c: true,
        });

        await updateSfQuoteStatus(record.sfQuoteId, "Accepted", false);

        if (record.opportunityId) {
          await closeOpportunityWon(
            record.opportunityId,
            record.totalAmount ?? 0,
            false,
          );
        }

        await linkInvoiceToStripeQuote(
          record.sfQuoteId,
          invoice.id as string,
        );
      } catch (err) {
        console.error("[Webhook] SF sync error:", err);
      }
    }

    if (record.sfQuoteNumber) {
      try {
        const { getStripeClient } = await import("@omnibridge/stripe");
        const stripe = getStripeClient();
        await stripe.quotes.update(record.stripeQuoteId, {
          metadata: { sf_quote_number: record.sfQuoteNumber },
        });
      } catch (err) {
        console.error("[Webhook] Failed to push sf_quote_number to Stripe:", err);
      }
    }
  }

  await prisma.auditLog.create({
    data: {
      action: "quote.invoice_paid",
      targetType: "stripe_quote",
      targetId: record.stripeQuoteId,
      payloadJson: {
        quoteRecordId: record.id,
        invoiceId: invoice.id,
        amountPaid: invoice.amount_paid,
        subscriptionId: subscriptionId ?? null,
      },
    },
  });
}

async function linkInvoiceToStripeQuote(
  sfQuoteId: string,
  stripeInvoiceId: string,
) {
  try {
    const { soql, updateSObject } = await import("@omnibridge/salesforce");
    const result = await soql<{ Id: string }>(
      `SELECT Id FROM Stripe_Invoice__c WHERE Stripe_Invoice_Id__c = '${stripeInvoiceId}' LIMIT 1`,
    );
    if (result.length > 0) {
      const sfInvoiceId = result[0]!.Id;
      await updateSObject("Stripe_Invoice__c", sfInvoiceId, {
        Stripe_Quote__c: sfQuoteId,
      });
      console.log(
        `[Webhook] Linked Stripe_Invoice__c ${sfInvoiceId} → Stripe_Quote__c ${sfQuoteId}`,
      );
    }
  } catch (err) {
    console.error("[Webhook] Failed to link invoice to Stripe Quote:", err);
  }
}
