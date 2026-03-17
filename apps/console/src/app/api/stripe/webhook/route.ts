import { NextResponse } from "next/server";
import type { Stripe } from "@omnibridge/stripe";
import { prisma } from "@omnibridge/db";
import { writeProductLog } from "@/lib/product-log";
import type { ProductLogAction } from "@/lib/product-log";
import { createSfQuoteEvent } from "@/lib/actions/sf-quote-event";
import { finalizeQuoteAcceptance } from "@/lib/actions/finalize-quote-acceptance";
import { upsertStripeCustomer } from "@/lib/actions/stripe-customer-sync";
import { upsertStripeProduct, upsertStripePrice } from "@/lib/actions/stripe-product-sync";
import { upsertStripeInvoice } from "@/lib/actions/stripe-invoice-sync";
import { upsertStripePayment } from "@/lib/actions/stripe-payment-sync";
import { upsertStripePaymentMethod, deleteStripePaymentMethod } from "@/lib/actions/stripe-payment-method-sync";
import { writeSyncEvent } from "@/lib/actions/sync-event-log";
import { resolveStripeActor } from "@/lib/actions/stripe-request-actor";

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

  const idempotencyKey = `stripe_webhook:${event.id}`;
  try {
    await prisma.idempotencyKey.create({
      data: {
        key: idempotencyKey,
        scope: "stripe_webhook",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json({ received: true, deduplicated: true });
    }
    throw err;
  }

  // Resolve actor from Stripe request log (non-blocking)
  const requestId = (event.request as { id?: string | null } | null)?.id ?? null;
  const reqIdempotencyKey = (event.request as { idempotency_key?: string | null } | null)?.idempotency_key ?? null;
  const actorPromise = resolveStripeActor(requestId, reqIdempotencyKey);

  /** Helper: write sync event with actor info attached */
  function logSyncEvent(params: {
    eventType: string;
    externalId: string;
    objectType: string;
    objectId: string;
    action: string;
  }) {
    actorPromise
      .then((actor) =>
        writeSyncEvent({
          source: "stripe",
          ...params,
          actorType: actor.actorType,
          actorId: actor.actorId,
          actorName: actor.actorName,
        }),
      )
      .catch(() => {});
  }

  switch (event.type) {
    // --- Customer mirror ---
    case "customer.created":
    case "customer.updated": {
      const customer = event.data.object as Stripe.Customer;
      await upsertStripeCustomer(customer);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "customer",
        objectId: customer.id,
        action: event.type === "customer.created" ? "created" : "updated",
      });
      break;
    }
    case "customer.deleted": {
      const deletedCus = event.data.object as unknown as { id: string };
      await prisma.stripeCustomer.delete({ where: { id: deletedCus.id } }).catch(() => {});
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "customer",
        objectId: deletedCus.id,
        action: "deleted",
      });
      break;
    }

    // --- Product mirror ---
    case "product.created": {
      const createdProduct = event.data.object as Stripe.Product;
      await upsertStripeProduct(createdProduct);
      await handleProductEvent("created", createdProduct, event);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "product",
        objectId: createdProduct.id,
        action: "created",
      });
      break;
    }
    case "product.updated": {
      const product = event.data.object as Stripe.Product;
      await upsertStripeProduct(product);
      const prev = (event.data as Stripe.Event.Data & { previous_attributes?: Record<string, unknown> })
        .previous_attributes;
      let action: ProductLogAction = "updated";
      if (prev && "active" in prev) {
        action = product.active ? "activated" : "deactivated";
      }
      if (await hasRecentOmnibridgeLog(product.id, action)) {
        return NextResponse.json({ received: true, skipped: "omnibridge_logged" });
      }
      await handleProductEvent(action, product, event, prev);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "product",
        objectId: product.id,
        action,
      });
      break;
    }
    case "product.deleted": {
      const deletedProduct = event.data.object as Stripe.Product;
      await prisma.stripeProduct.delete({ where: { id: deletedProduct.id } }).catch(() => {});
      await handleProductEvent("deleted", deletedProduct, event);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "product",
        objectId: deletedProduct.id,
        action: "deleted",
      });
      break;
    }

    // --- Price mirror ---
    case "price.created":
    case "price.updated": {
      const price = event.data.object as Stripe.Price;
      await upsertStripePrice(price);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "price",
        objectId: price.id,
        action: event.type === "price.created" ? "created" : "updated",
      });
      break;
    }
    case "price.deleted": {
      const deletedPrice = event.data.object as Stripe.Price;
      await prisma.stripePrice.delete({ where: { id: deletedPrice.id } }).catch(() => {});
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "price",
        objectId: deletedPrice.id,
        action: "deleted",
      });
      break;
    }
    // --- Invoice mirror ---
    case "invoice.created":
    case "invoice.updated":
    case "invoice.finalized":
    case "invoice.voided": {
      const invoice = event.data.object as Stripe.Invoice;
      await upsertStripeInvoice(invoice);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "invoice",
        objectId: invoice.id,
        action: event.type.split(".")[1],
      });
      break;
    }

    case "checkout.session.completed":
      await handleCheckoutCompleted(event.data.object as unknown as Record<string, unknown>);
      break;
    case "invoice.paid": {
      const paidInvoice = event.data.object as Stripe.Invoice;
      await upsertStripeInvoice(paidInvoice);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "invoice",
        objectId: paidInvoice.id,
        action: "paid",
      });
      await handleInvoicePaid(event.data.object as unknown as Record<string, unknown>);
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
    case "customer.subscription.paused":
    case "customer.subscription.resumed":
      await handleSubscriptionSync(event.data.object as Stripe.Subscription);
      break;
    case "invoice.payment_failed": {
      const failedInvoice = event.data.object as Stripe.Invoice;
      await upsertStripeInvoice(failedInvoice);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "invoice",
        objectId: failedInvoice.id,
        action: "payment_failed",
      });
      await handleInvoicePaymentFailed(event.data.object as unknown as Record<string, unknown>);
      break;
    }

    // --- Payment Intent mirror ---
    case "payment_intent.succeeded":
    case "payment_intent.payment_failed":
    case "payment_intent.canceled": {
      const pi = event.data.object as Stripe.PaymentIntent;
      await upsertStripePayment(pi);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "payment_intent",
        objectId: pi.id,
        action: event.type.split(".").slice(1).join("_"),
      });
      break;
    }

    // --- Payment Method mirror ---
    case "payment_method.attached":
    case "payment_method.updated": {
      const pm = event.data.object as Stripe.PaymentMethod;
      await upsertStripePaymentMethod(pm);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "payment_method",
        objectId: pm.id,
        action: event.type.split(".")[1],
      });
      break;
    }
    case "payment_method.detached": {
      const detachedPm = event.data.object as Stripe.PaymentMethod;
      await deleteStripePaymentMethod(detachedPm.id);
      logSyncEvent({
        eventType: event.type,
        externalId: event.id,
        objectType: "payment_method",
        objectId: detachedPm.id,
        action: "detached",
      });
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
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
    actorType: "webhook",
    actorId: undefined,
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

  const subscriptionId = (session as any).subscription as string | undefined;

  await finalizeQuoteAcceptance(metadata.quote_record_id, {
    subscriptionId,
    triggeredBy: "checkout",
    checkoutSessionId: String(session.id ?? ""),
  });
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

  const subscriptionId = (invoice as any).subscription as string | undefined;

  await finalizeQuoteAcceptance(record.id, {
    subscriptionId,
    triggeredBy: "invoice",
    invoiceId: String(invoice.id ?? ""),
    amountPaid: Number(invoice.amount_paid ?? 0),
  });
}

async function handleSubscriptionSync(sub: Stripe.Subscription) {
  try {
    const needsExpansion =
      typeof sub.customer === "string" ||
      !sub.items?.data?.[0]?.price?.product ||
      typeof sub.items?.data?.[0]?.price?.product === "string";

    let fullSub = sub;
    if (needsExpansion) {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();
      fullSub = await stripe.subscriptions.retrieve(sub.id, {
        expand: ["customer", "items.data.price.product"],
      });
    }

    const { upsertStripeSubscription } = await import(
      "@/lib/actions/stripe-subscription-sync"
    );
    await upsertStripeSubscription(fullSub);

    console.log(
      `[Webhook] Synced subscription ${sub.id} (${sub.status})`,
    );
  } catch (err) {
    console.error("[Webhook] Failed to sync subscription:", err);
  }
}

async function handleInvoicePaymentFailed(invoice: Record<string, unknown>) {
  const subscriptionId = (invoice as any).subscription as string | undefined;
  const stripeQuoteId = (invoice as any).quote as string | undefined;

  if (stripeQuoteId) {
    const record = await prisma.quoteRecord.findUnique({
      where: { stripeQuoteId },
    });

    if (record && !record.dryRun) {
      await prisma.auditLog.create({
        data: {
          action: "invoice.payment_failed",
          targetType: "stripe_invoice",
          targetId: String(invoice.id ?? ""),
          payloadJson: {
            quoteRecordId: record.id,
            stripeQuoteId,
            subscriptionId: subscriptionId ?? null,
            amountDue: Number(invoice.amount_due ?? 0),
            attemptCount: Number(invoice.attempt_count ?? 0),
          },
        },
      });

      if (record.sfQuoteId) {
        createSfQuoteEvent({
          sfQuoteId: record.sfQuoteId,
          action: "invoice.payment_failed",
          occurredAt: new Date(),
          source: "stripe",
          details: {
            invoiceId: invoice.id,
            amountDue: invoice.amount_due,
            attemptCount: invoice.attempt_count,
            subscriptionId: subscriptionId ?? null,
          },
        }).catch((err) =>
          console.error("[SF Event] invoice.payment_failed failed:", err),
        );
      }
    }
  }

  console.log(
    `[Webhook] Invoice payment failed: ${invoice.id} (subscription: ${subscriptionId ?? "none"})`,
  );
}
