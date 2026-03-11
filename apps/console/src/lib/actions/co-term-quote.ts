"use server";

import { randomUUID } from "crypto";
import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { flags } from "@/lib/feature-flags";
import {
  convertPriceToFrequency,
  intervalMatchesFrequency,
  billingIntervalToStripe,
  isOneTimePrice,
  computePaymentTerms,
} from "@/lib/billing-utils";
import type { BillingFrequency } from "@/lib/billing-utils";
import type { QuoteLineItem } from "./quotes";
import { generateAcceptToken } from "@/lib/utils/quote-tokens";

// ── Types ──

export interface CoTermQuoteInput {
  stripeCustomerId: string;
  customerName: string;
  sfAccountId?: string;
  opportunityId?: string;
  billToContactId?: string;
  parentSubscriptionId: string;
  parentScheduleId: string | null;
  existingItems: ExistingSubItem[];
  newLineItems: QuoteLineItem[];
  billingFrequency: BillingFrequency;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue?: number;
  effectiveTiming: "immediate" | "next_invoice" | "end_of_cycle";
  expiresInDays: number;
  idempotencyKey: string;
  dryRun?: boolean;
}

export interface ExistingSubItem {
  subscriptionItemId: string;
  priceId: string;
  productName: string;
  quantity: number;
  unitAmount: number;
  interval: string | null;
  intervalCount: number;
}

export interface CoTermQuoteResult {
  success: boolean;
  error?: string;
  quoteRecordId?: string;
  stripeQuoteId?: string;
  acceptUrl?: string;
  prorationAmountCents?: number;
  dryRun?: boolean;
  dryRunLog?: string[];
}

export interface ProrationPreviewResult {
  success: boolean;
  error?: string;
  totalProrationCents: number;
  lineItems: { description: string; amountCents: number }[];
}

// ── Proration Preview ──

export async function previewProration(input: {
  stripeCustomerId: string;
  parentSubscriptionId: string;
  parentScheduleId: string | null;
  existingItems: ExistingSubItem[];
  newLineItems: QuoteLineItem[];
  billingFrequency: BillingFrequency;
  effectiveTiming: "immediate" | "next_invoice" | "end_of_cycle";
}): Promise<ProrationPreviewResult> {
  const activatesNow =
    input.effectiveTiming === "immediate" || input.effectiveTiming === "next_invoice";

  if (flags.useMockStripe) {
    const mockTotal = input.newLineItems.reduce((sum, li) => {
      const unit = li.overrideUnitAmount ?? li.unitAmount;
      return sum + unit * li.quantity;
    }, 0);
    const prorated = Math.round(mockTotal * 0.45);
    return {
      success: true,
      totalProrationCents: activatesNow ? prorated : 0,
      lineItems: input.newLineItems.map((li) => ({
        description: `Prorated: ${li.productName}`,
        amountCents: activatesNow
          ? Math.round((li.overrideUnitAmount ?? li.unitAmount) * li.quantity * 0.45)
          : 0,
      })),
    };
  }

  if (!activatesNow) {
    return { success: true, totalProrationCents: 0, lineItems: [] };
  }

  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();

    const { interval: billingInterval, interval_count: billingIntervalCount } =
      billingIntervalToStripe(input.billingFrequency);

    const previewItems = buildScheduleItems(
      input.existingItems,
      input.newLineItems,
      input.billingFrequency,
      billingInterval,
      billingIntervalCount,
    );

    if (input.parentScheduleId) {
      const schedule = await stripe.subscriptionSchedules.retrieve(
        input.parentScheduleId,
      );
      const currentPhase = schedule.phases[0];
      if (!currentPhase) {
        return { success: false, error: "No active phase found on schedule.", totalProrationCents: 0, lineItems: [] };
      }

      const preview = await (stripe.invoices as any).createPreview({
        customer: input.stripeCustomerId,
        schedule: input.parentScheduleId,
        schedule_details: {
          phases: [
            {
              items: previewItems,
              start_date: currentPhase.start_date,
              end_date: currentPhase.end_date,
              proration_behavior: "create_prorations",
            },
          ],
        },
      });

      return extractProrationFromPreview(preview);
    }

    // Fallback: use subscription-based preview
    const subItems = input.newLineItems.map((li) => {
      const needsConvert =
        !isOneTimePrice(li.interval) &&
        !intervalMatchesFrequency(li.interval, input.billingFrequency);

      if (needsConvert) {
        const converted = convertPriceToFrequency(
          li.overrideUnitAmount ?? li.unitAmount,
          li.interval,
          input.billingFrequency,
        );
        return {
          price_data: {
            product: li.productId,
            unit_amount: converted,
            currency: li.currency,
            recurring: { interval: billingInterval, interval_count: billingIntervalCount },
          },
          quantity: li.quantity,
        };
      }
      return { price: li.priceId, quantity: li.quantity };
    });

    const preview = await (stripe.invoices as any).createPreview({
      customer: input.stripeCustomerId,
      subscription: input.parentSubscriptionId,
      subscription_details: {
        items: [
          ...input.existingItems.map((ei) => ({
            id: ei.subscriptionItemId,
            price: ei.priceId,
            quantity: ei.quantity,
          })),
          ...subItems,
        ],
        proration_behavior: "create_prorations",
      },
    });

    return extractProrationFromPreview(preview);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Proration preview failed: ${msg}`, totalProrationCents: 0, lineItems: [] };
  }
}

function extractProrationFromPreview(preview: any): ProrationPreviewResult {
  const lines: { description: string; amountCents: number }[] = [];
  let total = 0;

  for (const line of preview.lines?.data ?? []) {
    const isProration =
      line.proration === true ||
      line.parent?.subscription_item_details?.proration === true;
    if (isProration) {
      lines.push({
        description: line.description ?? "Proration",
        amountCents: line.amount ?? 0,
      });
      total += line.amount ?? 0;
    }
  }

  return { success: true, totalProrationCents: total, lineItems: lines };
}

// ── Create Co-Term Quote ──

export async function createCoTermQuote(
  input: CoTermQuoteInput,
): Promise<CoTermQuoteResult> {
  const session = await requireSession();
  const userId = session.user.id;
  const dryRun = input.dryRun ?? false;
  const actionLog: string[] = [];

  if (input.newLineItems.length === 0) {
    return { success: false, error: "At least one new line item is required." };
  }

  // Check for in-flight co-term quotes on the same subscription
  const inflight = await prisma.quoteRecord.findFirst({
    where: {
      parentSubscriptionId: input.parentSubscriptionId,
      quoteType: "co_term",
      status: { in: ["draft", "open", "pending_payment"] },
    },
  });
  if (inflight) {
    return {
      success: false,
      error: `An amendment quote (${inflight.stripeQuoteId}) is already in progress for this subscription. Cancel it first.`,
    };
  }

  // Validate the subscription is still active
  if (!dryRun && !flags.useMockStripe) {
    try {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();
      const sub = await stripe.subscriptions.retrieve(input.parentSubscriptionId);
      if (sub.status !== "active" && sub.status !== "trialing") {
        return { success: false, error: `Subscription is ${sub.status}, not eligible for co-term.` };
      }
      if (sub.cancel_at_period_end || sub.cancel_at) {
        return { success: false, error: "Subscription is pending cancellation — cannot add products." };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { success: false, error: `Failed to validate subscription: ${msg}` };
    }
  }

  const expiresAt = new Date(
    Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
  );

  // Calculate total for new items
  let newItemsTotal = 0;
  const currency = input.newLineItems[0]?.currency ?? "usd";
  for (const li of input.newLineItems) {
    const unit = li.overrideUnitAmount ?? li.unitAmount;
    const oneTime = isOneTimePrice(li.interval);
    const converted = oneTime ? unit : convertPriceToFrequency(unit, li.interval, input.billingFrequency);
    newItemsTotal += converted * li.quantity;
  }

  // Preview proration (both "immediate" and "next_invoice" create prorations)
  let prorationAmountCents = 0;
  if (input.effectiveTiming === "immediate" || input.effectiveTiming === "next_invoice") {
    const preview = await previewProration({
      stripeCustomerId: input.stripeCustomerId,
      parentSubscriptionId: input.parentSubscriptionId,
      parentScheduleId: input.parentScheduleId,
      existingItems: input.existingItems,
      newLineItems: input.newLineItems,
      billingFrequency: input.billingFrequency,
      effectiveTiming: input.effectiveTiming,
    });
    if (preview.success) {
      prorationAmountCents = preview.totalProrationCents;
      actionLog.push(
        `[Proration] Estimated prorated charge: $${(prorationAmountCents / 100).toFixed(2)}`,
      );
    } else {
      actionLog.push(`[Proration] Preview failed: ${preview.error}`);
    }
  }

  const stripeQuoteId = dryRun
    ? `qt_coterm_dryrun_${randomUUID().slice(0, 8)}`
    : flags.useMockStripe
      ? `qt_coterm_mock_${randomUUID().slice(0, 8)}`
      : `qt_coterm_${randomUUID().slice(0, 8)}`;

  if (dryRun) {
    actionLog.push(`[DRY RUN] Co-term quote for subscription ${input.parentSubscriptionId}`);
    actionLog.push(`[DRY RUN] Schedule: ${input.parentScheduleId || "none"}`);
    actionLog.push(`[DRY RUN] Timing: ${input.effectiveTiming}`);
    actionLog.push(`[DRY RUN] Existing items: ${input.existingItems.length}`);
    actionLog.push(`[DRY RUN] New items: ${input.newLineItems.length}`);
    for (const li of input.newLineItems) {
      const unit = li.overrideUnitAmount ?? li.unitAmount;
      actionLog.push(`  - ${li.productName} × ${li.quantity} @ $${(unit / 100).toFixed(2)}`);
    }
    actionLog.push(`[DRY RUN] New items total: $${(newItemsTotal / 100).toFixed(2)}/cycle`);
    if (prorationAmountCents > 0) {
      actionLog.push(`[DRY RUN] Proration estimate: $${(prorationAmountCents / 100).toFixed(2)}`);
    }
    actionLog.push(`[DRY RUN] Collection: ${input.collectionMethod}`);
  }

  const acceptToken = generateAcceptToken();

  const quoteRecord = await prisma.quoteRecord.create({
    data: {
      stripeQuoteId,
      customerId: input.stripeCustomerId,
      customerName: input.customerName,
      stripeCustomerId: input.stripeCustomerId,
      sfAccountId: input.sfAccountId ?? null,
      opportunityId: input.opportunityId ?? null,
      collectionMethod: input.collectionMethod,
      paymentTerms: computePaymentTerms(input.collectionMethod, input.daysUntilDue),
      daysUntilDue:
        input.collectionMethod === "send_invoice"
          ? input.daysUntilDue ?? 30
          : null,
      billingFrequency: input.billingFrequency,
      status: dryRun ? "dry_run" : "draft",
      acceptToken,
      totalAmount: newItemsTotal,
      currency,
      expiresAt,
      lineItemsJson: input.newLineItems as unknown as import("@omnibridge/db").Prisma.InputJsonValue,
      billToContactId: input.billToContactId ?? null,
      quoteType: "co_term",
      parentSubscriptionId: input.parentSubscriptionId,
      parentScheduleId: input.parentScheduleId,
      effectiveTiming: input.effectiveTiming,
      prorationAmountCents,
      existingItemsJson: input.existingItems as unknown as import("@omnibridge/db").Prisma.InputJsonValue,
      dryRun,
      createdBy: userId,
    },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      action: dryRun ? "co_term_quote.dry_run" : "co_term_quote.created",
      targetType: "co_term_quote",
      targetId: stripeQuoteId,
      payloadJson: {
        quoteRecordId: quoteRecord.id,
        parentSubscriptionId: input.parentSubscriptionId,
        parentScheduleId: input.parentScheduleId,
        effectiveTiming: input.effectiveTiming,
        newItemCount: input.newLineItems.length,
        newItemsTotal,
        prorationAmountCents,
        currency,
        dryRun,
        dryRunLog: dryRun ? actionLog : undefined,
      },
    },
  });

  const acceptUrl = `/accept/${acceptToken}`;

  return {
    success: true,
    quoteRecordId: quoteRecord.id,
    stripeQuoteId,
    acceptUrl,
    prorationAmountCents,
    dryRun,
    dryRunLog: dryRun ? actionLog : undefined,
  };
}

// ── Accept Co-Term Quote (called from accept page or webhook) ──

export async function acceptCoTermQuote(
  quoteRecordId: string,
): Promise<{ success: boolean; error?: string; dryRunLog?: string[] }> {
  const record = await prisma.quoteRecord.findUnique({
    where: { id: quoteRecordId },
  });
  if (!record) return { success: false, error: "Quote not found." };
  if (record.quoteType !== "co_term") {
    return { success: false, error: "Not a co-term quote." };
  }
  if (record.status === "accepted") {
    return { success: false, error: "Quote already accepted." };
  }
  if (record.status !== "open" && record.status !== "signed" && record.status !== "dry_run") {
    return { success: false, error: `Cannot accept quote in "${record.status}" status.` };
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    return { success: false, error: "Quote has expired." };
  }

  if (record.dryRun) {
    const log = [`[DRY RUN] Would apply co-term amendment to ${record.parentSubscriptionId}`];
    log.push(`[DRY RUN] Timing: ${record.effectiveTiming}`);
    log.push(`[DRY RUN] Schedule: ${record.parentScheduleId ?? "none"}`);
    return { success: true, dryRunLog: log };
  }

  if (flags.useMockStripe) {
    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: { status: "accepted", acceptedAt: new Date() },
    });
    return { success: true };
  }

  return applyCoTermAmendment(record);
}

// ── Apply amendment to Stripe ──

async function applyCoTermAmendment(
  record: any,
): Promise<{ success: boolean; error?: string }> {
  const { getStripeClient } = await import("@omnibridge/stripe");
  const stripe = getStripeClient();

  const newLineItems: QuoteLineItem[] = (record.lineItemsJson as QuoteLineItem[] | null) ?? [];
  const existingItems: ExistingSubItem[] = (record.existingItemsJson as ExistingSubItem[] | null) ?? [];

  if (newLineItems.length === 0) {
    return { success: false, error: "No new items to add." };
  }

  const billingFrequency = record.billingFrequency as BillingFrequency;
  const { interval: billingInterval, interval_count: billingIntervalCount } =
    billingIntervalToStripe(billingFrequency);

  try {
    if (record.parentScheduleId) {
      await applyViaSchedule(
        stripe,
        record.parentScheduleId,
        existingItems,
        newLineItems,
        billingFrequency,
        billingInterval,
        billingIntervalCount,
        record.effectiveTiming,
      );
    } else {
      await applyViaSubscriptionUpdate(
        stripe,
        record.parentSubscriptionId,
        newLineItems,
        billingFrequency,
        billingInterval,
        billingIntervalCount,
        record.effectiveTiming,
      );
    }

    await prisma.quoteRecord.update({
      where: { id: record.id },
      data: { status: "accepted", acceptedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        action: "co_term_quote.accepted",
        targetType: "co_term_quote",
        targetId: record.stripeQuoteId,
        payloadJson: {
          quoteRecordId: record.id,
          parentSubscriptionId: record.parentSubscriptionId,
          parentScheduleId: record.parentScheduleId,
          effectiveTiming: record.effectiveTiming,
        },
      },
    });

    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `Failed to apply amendment: ${msg}` };
  }
}

async function applyViaSchedule(
  stripe: any,
  scheduleId: string,
  existingItems: ExistingSubItem[],
  newLineItems: QuoteLineItem[],
  billingFrequency: BillingFrequency,
  billingInterval: string,
  billingIntervalCount: number,
  timing: string,
) {
  const schedule = await stripe.subscriptionSchedules.retrieve(scheduleId);
  const currentPhase = schedule.phases[0];
  if (!currentPhase) throw new Error("No active phase on schedule.");

  const allItems = buildScheduleItems(
    existingItems,
    newLineItems,
    billingFrequency,
    billingInterval,
    billingIntervalCount,
  );

  if (timing === "immediate" || timing === "next_invoice") {
    await stripe.subscriptionSchedules.update(scheduleId, {
      phases: [
        {
          items: allItems,
          start_date: currentPhase.start_date,
          end_date: currentPhase.end_date,
          proration_behavior: "create_prorations",
        },
        ...schedule.phases.slice(1).map((p: any) => ({
          items: p.items.map((i: any) => ({ price: i.price, quantity: i.quantity })),
          start_date: p.start_date,
          end_date: p.end_date,
        })),
      ],
    } as any);

    // "immediate" timing: force-collect the proration now via a separate invoice
    if (timing === "immediate") {
      try {
        const subId = typeof schedule.subscription === "string"
          ? schedule.subscription
          : schedule.subscription?.id;
        if (subId) {
          const invoice = await stripe.invoices.create({
            customer: (await stripe.subscriptions.retrieve(subId)).customer as string,
            subscription: subId,
            pending_invoice_items_behavior: "include",
          });
          if (invoice.status === "draft") {
            await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: true });
          }
        }
      } catch (err) {
        console.warn("[CoTerm] Could not force immediate invoice — prorations will roll to next cycle:", err);
      }
    }
  } else {
    // End of billing cycle: split current phase into two
    const sub = schedule.subscription
      ? typeof schedule.subscription === "string"
        ? await stripe.subscriptions.retrieve(schedule.subscription)
        : schedule.subscription
      : null;

    const nextBillingTs = sub?.current_period_end ?? currentPhase.end_date;

    const existingOnlyItems = existingItems.map((ei) => ({
      price: ei.priceId,
      quantity: ei.quantity,
    }));

    const phases: any[] = [];

    if (nextBillingTs < currentPhase.end_date) {
      phases.push({
        items: existingOnlyItems,
        start_date: currentPhase.start_date,
        end_date: nextBillingTs,
        proration_behavior: "none",
      });
      phases.push({
        items: allItems,
        start_date: nextBillingTs,
        end_date: currentPhase.end_date,
        proration_behavior: "none",
      });
    } else {
      phases.push({
        items: allItems,
        start_date: currentPhase.start_date,
        end_date: currentPhase.end_date,
        proration_behavior: "none",
      });
    }

    // Preserve subsequent phases
    for (const p of schedule.phases.slice(1)) {
      phases.push({
        items: p.items.map((i: any) => ({ price: i.price, quantity: i.quantity })),
        start_date: p.start_date,
        end_date: p.end_date,
      });
    }

    await stripe.subscriptionSchedules.update(scheduleId, { phases } as any);
  }
}

async function applyViaSubscriptionUpdate(
  stripe: any,
  subscriptionId: string,
  newLineItems: QuoteLineItem[],
  billingFrequency: BillingFrequency,
  billingInterval: string,
  billingIntervalCount: number,
  timing: string,
) {
  const items = newLineItems.map((li) => {
    const oneTime = isOneTimePrice(li.interval);
    const needsConvert =
      !oneTime && !intervalMatchesFrequency(li.interval, billingFrequency);

    if (needsConvert) {
      const converted = convertPriceToFrequency(
        li.overrideUnitAmount ?? li.unitAmount,
        li.interval,
        billingFrequency,
      );
      return {
        price_data: {
          product: li.productId,
          unit_amount: converted,
          currency: li.currency,
          recurring: { interval: billingInterval, interval_count: billingIntervalCount },
        },
        quantity: li.quantity,
      };
    }
    return { price: li.priceId, quantity: li.quantity };
  });

  const activatesNow = timing === "immediate" || timing === "next_invoice";

  await stripe.subscriptions.update(subscriptionId, {
    items,
    proration_behavior: activatesNow ? "create_prorations" : "none",
  });

  // "immediate" timing: force-collect the proration now via a separate invoice
  if (timing === "immediate") {
    try {
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      const invoice = await stripe.invoices.create({
        customer: sub.customer as string,
        subscription: subscriptionId,
        pending_invoice_items_behavior: "include",
      });
      if (invoice.status === "draft") {
        await stripe.invoices.finalizeInvoice(invoice.id, { auto_advance: true });
      }
    } catch (err) {
      console.warn("[CoTerm] Could not force immediate invoice — prorations will roll to next cycle:", err);
    }
  }
}

function buildScheduleItems(
  existingItems: ExistingSubItem[],
  newLineItems: QuoteLineItem[],
  billingFrequency: BillingFrequency,
  billingInterval: string,
  billingIntervalCount: number,
): any[] {
  const existing = existingItems.map((ei) => ({
    price: ei.priceId,
    quantity: ei.quantity,
  }));

  const added = newLineItems.map((li) => {
    const oneTime = isOneTimePrice(li.interval);
    const needsConvert =
      !oneTime && !intervalMatchesFrequency(li.interval, billingFrequency);

    if (needsConvert) {
      const converted = convertPriceToFrequency(
        li.overrideUnitAmount ?? li.unitAmount,
        li.interval,
        billingFrequency,
      );
      return {
        price_data: {
          product: li.productId,
          unit_amount: converted,
          currency: li.currency,
          recurring: { interval: billingInterval, interval_count: billingIntervalCount },
        },
        quantity: li.quantity,
      };
    }
    return { price: li.priceId, quantity: li.quantity };
  });

  return [...existing, ...added];
}
