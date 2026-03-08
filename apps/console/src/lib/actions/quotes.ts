"use server";

import { randomUUID } from "crypto";
import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { flags } from "@/lib/feature-flags";
import { createSfQuoteMirror } from "./sf-quote-mirror";
import {
  billingIntervalToStripe,
  convertPriceToFrequency,
  computeContractEndDate,
  intervalMatchesFrequency,
} from "@/lib/billing-utils";
import type { ContractTerm, BillingFrequency } from "@/lib/billing-utils";

export interface QuoteLineItem {
  priceId: string;
  productId: string;
  productName: string;
  quantity: number;
  nickname: string;
  unitAmount: number;
  currency: string;
  interval: string;
  overrideUnitAmount?: number | null;
  sfProductId?: string | null;
}

export interface CreateQuoteInput {
  stripeCustomerId: string;
  customerName: string;
  sfAccountId?: string;
  opportunityId?: string;
  lineItems: QuoteLineItem[];
  contractTerm: ContractTerm;
  billingFrequency: BillingFrequency;
  collectionMethod: "charge_automatically" | "send_invoice";
  daysUntilDue?: number;
  effectiveDate?: string;
  trialPeriodDays?: number;
  expiresInDays: number;
  idempotencyKey: string;
  dryRun?: boolean;
}

export interface CreateQuoteResult {
  success: boolean;
  error?: string;
  quoteRecordId?: string;
  stripeQuoteId?: string;
  sfQuoteId?: string;
  sfQuoteNumber?: string;
  acceptUrl?: string;
  auditLogId?: string;
  dryRun?: boolean;
  dryRunLog?: string[];
  productValidation?: { valid: boolean; missingProducts: string[] };
}

function generateAcceptToken(): string {
  return `qt_${Date.now().toString(36)}_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

export async function createQuoteDraft(
  input: CreateQuoteInput,
): Promise<CreateQuoteResult> {
  const session = await requireSession();
  const userId = session.user.id;
  const requestId = randomUUID();
  const dryRun = input.dryRun ?? false;
  const actionLog: string[] = [];

  if (input.lineItems.length === 0) {
    return { success: false, error: "At least one line item is required." };
  }

  const needsEnrichment = input.lineItems.some((li) => !li.sfProductId);
  if (needsEnrichment && !flags.useMockStripe) {
    try {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();
      for (const li of input.lineItems) {
        if (li.sfProductId) continue;
        const prod = await stripe.products.retrieve(li.productId);
        li.sfProductId =
          prod.metadata?.salesforce_product_id ??
          prod.metadata?.salesforce_product2_id ??
          prod.metadata?.sf_product_id ??
          null;
      }
    } catch {
      actionLog.push("[WARN] Could not enrich SF product mappings from Stripe metadata");
    }
  }

  const expiresAt = new Date(
    Date.now() + input.expiresInDays * 24 * 60 * 60 * 1000,
  );
  const expiresAtUnix = Math.floor(expiresAt.getTime() / 1000);

  let stripeQuoteId = "";
  let totalAmount = 0;
  let listAmount = 0;
  const currency = input.lineItems[0]?.currency ?? "usd";

  for (const li of input.lineItems) {
    const effectiveUnit = li.overrideUnitAmount ?? li.unitAmount;
    const oneTime =
      !li.interval || li.interval === "one-time" || li.interval === "one_time";

    const effectiveConverted = oneTime
      ? effectiveUnit
      : convertPriceToFrequency(effectiveUnit, li.interval, input.billingFrequency);
    const standardConverted = oneTime
      ? li.unitAmount
      : convertPriceToFrequency(li.unitAmount, li.interval, input.billingFrequency);

    totalAmount += effectiveConverted * li.quantity;
    listAmount += standardConverted * li.quantity;
  }

  const productValidation = validateProductCrossMapping(input.lineItems);
  if (!productValidation.valid) {
    actionLog.push(
      `[WARN] Products missing SF mapping: ${productValidation.missingProducts.join(", ")}`,
    );
  }

  // Validate Stripe customer has email for subscription creation
  if (!dryRun && input.stripeCustomerId && input.sfAccountId) {
    try {
      const { validateStripeCustomerEmail } = await import("./stripe-customer-sync");
      const emailResult = await validateStripeCustomerEmail(
        input.stripeCustomerId, 
        input.sfAccountId
      );
      
      if (!emailResult.success) {
        actionLog.push(`[ERROR] Customer email validation failed: ${emailResult.error}`);
        return {
          success: false,
          error: `Customer email validation failed: ${emailResult.error}`,
          quoteRecordId: null,
          stripeQuoteId: null,
          dryRun: false,
          log: actionLog,
        };
      }
      
      actionLog.push(`[Validation] Customer email confirmed: ${emailResult.updatedEmail}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      actionLog.push(`[ERROR] Email validation error: ${message}`);
      return {
        success: false,
        error: `Email validation error: ${message}`,
        quoteRecordId: null,
        stripeQuoteId: null,
        dryRun: false,
        log: actionLog,
      };
    }
  }

  const { interval: billingInterval, interval_count: billingIntervalCount } =
    billingIntervalToStripe(input.billingFrequency);

  const isOneTime = (li: QuoteLineItem) =>
    !li.interval || li.interval === "one-time" || li.interval === "one_time";

  if (dryRun) {
    stripeQuoteId = `qt_dryrun_${randomUUID().slice(0, 8)}`;
    actionLog.push(`[DRY RUN] Would create Stripe quote for customer ${input.stripeCustomerId}`);
    actionLog.push(`[DRY RUN] Contract: ${input.contractTerm} | Billing: ${input.billingFrequency}`);
    actionLog.push(`[DRY RUN] Line items: ${input.lineItems.length}`);
    let discountCount = 0;
    let premiumCount = 0;
    let freqConvertCount = 0;
    for (let i = 0; i < input.lineItems.length; i++) {
      const li = input.lineItems[i];
      const effectiveUnit = li.overrideUnitAmount ?? li.unitAmount;
      let billedAmount = effectiveUnit;
      let note = "";

      if (!isOneTime(li) && !intervalMatchesFrequency(li.interval, input.billingFrequency)) {
        billedAmount = convertPriceToFrequency(effectiveUnit, li.interval, input.billingFrequency);
        note += ` [FREQ] ${li.interval} → ${input.billingFrequency} ($${(billedAmount / 100).toFixed(2)}/cycle via price_data)`;
        freqConvertCount++;
      }

      if (li.overrideUnitAmount != null && li.overrideUnitAmount !== li.unitAmount) {
        const stdPrice = li.unitAmount / 100;
        const overPrice = li.overrideUnitAmount / 100;
        if (li.overrideUnitAmount < li.unitAmount) {
          note += ` [DISCOUNT] std $${stdPrice.toFixed(2)} → $${overPrice.toFixed(2)}`;
          discountCount++;
        } else {
          note += ` [PREMIUM] std $${stdPrice.toFixed(2)} → $${overPrice.toFixed(2)}`;
          premiumCount++;
        }
      }

      const lineTotal = (billedAmount * li.quantity) / 100;
      actionLog.push(
        `  ${i + 1}. ${li.productName} (${li.priceId}) × ${li.quantity} = $${lineTotal.toFixed(2)} ${currency}${note}`,
      );
    }
    if (freqConvertCount > 0) {
      actionLog.push(`[DRY RUN] Would use price_data for ${freqConvertCount} item(s) with frequency conversion`);
    }
    if (discountCount > 0) {
      actionLog.push(`[DRY RUN] Would create ${discountCount} inline coupon(s) for discounted items`);
    }
    if (premiumCount > 0) {
      actionLog.push(`[DRY RUN] Would use price_data for ${premiumCount} premium-priced item(s)`);
    }
    actionLog.push(`[DRY RUN] Collection method: ${input.collectionMethod}`);
    if (input.collectionMethod === "send_invoice" && input.daysUntilDue) {
      actionLog.push(`[DRY RUN] Net terms: ${input.daysUntilDue} days`);
    }
    actionLog.push(`[DRY RUN] Expires: ${expiresAt.toISOString()}`);
    actionLog.push(`[DRY RUN] Would create Stripe quote in draft (finalized on send)`);
  } else if (flags.useMockStripe) {
    stripeQuoteId = `qt_mock_${randomUUID().slice(0, 8)}`;
  } else {
    try {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();

      const couponMap = new Map<number, string>();
      for (let i = 0; i < input.lineItems.length; i++) {
        const li = input.lineItems[i];
        if (li.overrideUnitAmount != null && li.overrideUnitAmount < li.unitAmount) {
          const discountPerUnit = li.unitAmount - li.overrideUnitAmount;
          const coupon = await stripe.coupons.create({
            name: `Quote discount — ${li.productName}`,
            duration: "once",
            amount_off: discountPerUnit * li.quantity,
            currency: li.currency,
            metadata: { source: "displai_omni", inline: "true" },
          } as any);
          couponMap.set(i, coupon.id);
          actionLog.push(
            `[Coupon] Created ${coupon.id} for ${li.productName}: -$${((discountPerUnit * li.quantity) / 100).toFixed(2)}`,
          );
        }
      }

      const lineItems = input.lineItems.map((li, i) => {
        const hasOverride = li.overrideUnitAmount != null && li.overrideUnitAmount !== li.unitAmount;
        const isDiscount = hasOverride && li.overrideUnitAmount! < li.unitAmount;
        const isPremium = hasOverride && li.overrideUnitAmount! > li.unitAmount;
        const oneTime = isOneTime(li);
        const needsFreqConvert =
          !oneTime && !intervalMatchesFrequency(li.interval, input.billingFrequency);

        const effectiveUnit = li.overrideUnitAmount ?? li.unitAmount;

        if (isPremium || needsFreqConvert) {
          const convertedAmount = needsFreqConvert
            ? convertPriceToFrequency(effectiveUnit, li.interval, input.billingFrequency)
            : effectiveUnit;

          const item: Record<string, unknown> = {
            quantity: li.quantity,
            price_data: {
              product: li.productId,
              unit_amount: convertedAmount,
              currency: li.currency,
              ...(!oneTime
                ? {
                    recurring: {
                      interval: billingInterval,
                      interval_count: billingIntervalCount,
                    },
                  }
                : {}),
            },
          };
          actionLog.push(
            `[Price] price_data for ${li.productName}: $${(convertedAmount / 100).toFixed(2)}${oneTime ? " one-time" : `/${input.billingFrequency}`}`,
          );
          return item;
        }

        const item: Record<string, unknown> = {
          price: li.priceId,
          quantity: li.quantity,
        };
        if (isDiscount) {
          const couponId = couponMap.get(i);
          if (couponId) {
            item.discounts = [{ coupon: couponId }];
          }
        }
        return item;
      });

      const subscriptionData: Record<string, unknown> = {};
      if (input.effectiveDate) {
        subscriptionData.effective_date = Math.floor(
          new Date(input.effectiveDate).getTime() / 1000,
        );
      }
      if (input.trialPeriodDays) {
        subscriptionData.trial_period_days = input.trialPeriodDays;
      }

      const hasLineDiscounts = couponMap.size > 0;

      const createParams: Record<string, unknown> = {
        customer: input.stripeCustomerId,
        line_items: lineItems,
        collection_method: input.collectionMethod,
        expires_at: expiresAtUnix,
        metadata: {
          source: "displai_omni",
          contract_term: input.contractTerm,
          billing_frequency: input.billingFrequency,
          ...(input.sfAccountId ? { sf_account_id: input.sfAccountId } : {}),
          ...(input.opportunityId ? { opportunity_id: input.opportunityId } : {}),
          stripe_customer_id: input.stripeCustomerId,
        },
        ...(Object.keys(subscriptionData).length > 0
          ? { subscription_data: subscriptionData }
          : {}),
        ...(input.collectionMethod === "send_invoice"
          ? { invoice_settings: { days_until_due: input.daysUntilDue ?? 0 } }
          : {}),
        ...(hasLineDiscounts ? { discounts: [] } : {}),
      };

      const quote = await (stripe.quotes as any).create(createParams, {
        idempotencyKey: input.idempotencyKey,
      });
      stripeQuoteId = quote.id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stripe API error";
      return { success: false, error: message };
    }
  }

  let sfQuoteId: string | null = null;
  let sfQuoteNumber: string | null = null;
  let sfQuoteLineIds: string[] = [];
  if (input.opportunityId && input.sfAccountId) {
    const { result: mirrorResult, log: mirrorLog } =
      await createSfQuoteMirror(
        {
          opportunityId: input.opportunityId,
          sfAccountId: input.sfAccountId,
          stripeQuoteId,
          stripeCustomerId: input.stripeCustomerId,
          collectionMethod: input.collectionMethod,
          daysUntilDue: input.daysUntilDue,
          contractTerm: input.contractTerm,
          billingFrequency: input.billingFrequency,
          effectiveDate: input.effectiveDate,
          totalAmount,
          listAmount,
          currency,
          expiresAt,
          lineItems: input.lineItems,
          creatorName:
            (session.user as { name?: string }).name ?? session.user.email ?? "Unknown",
        },
        dryRun,
      );
    sfQuoteId = mirrorResult.sfQuoteId;
    sfQuoteNumber = mirrorResult.sfQuoteNumber ?? null;
    sfQuoteLineIds = mirrorResult.sfQuoteLineIds;
    actionLog.push(...mirrorLog);

    if (sfQuoteId && !dryRun && !flags.useMockStripe) {
      try {
        const { getStripeClient } = await import("@omnibridge/stripe");
        const stripe = getStripeClient();
        await stripe.quotes.update(stripeQuoteId, {
          metadata: {
            sf_quote_id: sfQuoteId,
            ...(sfQuoteNumber ? { sf_quote_number: sfQuoteNumber } : {}),
          },
        });
        actionLog.push(`[Stripe] Updated quote metadata with sf_quote_id=${sfQuoteId}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        actionLog.push(`[Stripe] WARN: Failed to update metadata: ${msg}`);
      }
    }
  } else {
    actionLog.push(
      `[SKIP] SF Quote mirror skipped — ${!input.opportunityId ? "no opportunity" : "no SF Account ID"}`,
    );
  }

  const acceptToken = generateAcceptToken();

  const contractStart = input.effectiveDate
    ? new Date(input.effectiveDate)
    : new Date();
  const contractEndDate = computeContractEndDate(contractStart, input.contractTerm);

  const quoteRecord = await prisma.quoteRecord.create({
    data: {
      stripeQuoteId,
      customerId: input.stripeCustomerId,
      customerName: input.customerName,
      stripeCustomerId: input.stripeCustomerId,
      sfAccountId: input.sfAccountId ?? null,
      opportunityId: input.opportunityId ?? null,
      sfQuoteId,
      sfQuoteNumber,
      sfQuoteLineIds: sfQuoteLineIds.length > 0 ? sfQuoteLineIds : undefined,
      collectionMethod: input.collectionMethod,
      paymentTerms:
        input.collectionMethod === "send_invoice"
          ? input.daysUntilDue === 0
            ? "Due on receipt"
            : `Net ${input.daysUntilDue ?? 30}`
          : "Prepay",
      daysUntilDue:
        input.collectionMethod === "send_invoice"
          ? input.daysUntilDue ?? 30
          : null,
      contractTerm: input.contractTerm,
      billingFrequency: input.billingFrequency,
      contractEndDate,
      status: dryRun ? "dry_run" : "draft",
      acceptToken,
      totalAmount,
      currency,
      expiresAt,
      lineItemsJson: JSON.stringify(input.lineItems),
      dryRun,
      createdBy: userId,
    },
  });

  const auditLog = await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      action: dryRun ? "quote.dry_run" : "quote.created",
      targetType: "stripe_quote",
      targetId: stripeQuoteId,
      requestId,
      payloadJson: JSON.parse(
        JSON.stringify({
          quoteRecordId: quoteRecord.id,
          stripeQuoteId,
          sfQuoteId,
          collectionMethod: input.collectionMethod,
          lineItemCount: input.lineItems.length,
          totalAmount,
          currency,
          expiresAt: expiresAt.toISOString(),
          dryRun,
          dryRunLog: dryRun ? actionLog : undefined,
        }),
      ),
    },
  });

  const acceptUrl = `/accept/${acceptToken}`;

  return {
    success: true,
    quoteRecordId: quoteRecord.id,
    stripeQuoteId,
    sfQuoteId: sfQuoteId ?? undefined,
    sfQuoteNumber: sfQuoteNumber ?? undefined,
    acceptUrl,
    auditLogId: auditLog.id,
    dryRun,
    dryRunLog: dryRun ? actionLog : undefined,
    productValidation: productValidation.valid ? undefined : productValidation,
  };
}

function validateProductCrossMapping(
  lineItems: QuoteLineItem[],
): { valid: boolean; missingProducts: string[] } {
  const missing = lineItems
    .filter((li) => !li.sfProductId)
    .map((li) => `${li.productName} (${li.productId})`);
  return {
    valid: missing.length === 0,
    missingProducts: [...new Set(missing)],
  };
}

export async function finalizeStripeQuote(
  quoteRecordId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();

  const record = await prisma.quoteRecord.findUnique({
    where: { id: quoteRecordId },
  });
  if (!record) return { success: false, error: "Quote record not found." };
  if (record.dryRun) return { success: true };
  if (record.status !== "draft") {
    return { success: false, error: `Cannot finalize a quote in "${record.status}" status.` };
  }

  if (flags.useMockStripe) {
    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: { status: "open" },
    });
    return { success: true };
  }

  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();
    await (stripe.quotes as any).finalizeQuote(record.stripeQuoteId);

    const finalized = await stripe.quotes.retrieve(record.stripeQuoteId);
    const stripeQuoteNumber = (finalized as any).number as string | null;

    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: {
        status: "open",
        ...(stripeQuoteNumber ? { stripeQuoteNumber } : {}),
      },
    });

    await prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "quote.finalized",
        targetType: "stripe_quote",
        targetId: record.stripeQuoteId,
        payloadJson: { quoteRecordId, stripeQuoteNumber },
      },
    });

    if (record.sfQuoteId) {
      try {
        const { updateSfQuoteStatus } = await import("./sf-quote-mirror");
        await updateSfQuoteStatus(record.sfQuoteId, "Sent", false);
      } catch (err) {
        console.warn("[Finalize] Failed to update SF quote status to Sent:", err);
      }
    }

    return { success: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stripe API error";
    return { success: false, error: message };
  }
}

export async function cancelQuote(
  quoteRecordId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();

  const record = await prisma.quoteRecord.findUnique({
    where: { id: quoteRecordId },
  });
  if (!record) return { success: false, error: "Quote not found." };
  if (record.status !== "open" && record.status !== "draft") {
    return { success: false, error: `Cannot cancel a quote in "${record.status}" status.` };
  }

  if (record.dryRun) {
    await prisma.quoteRecord.update({
      where: { id: quoteRecordId },
      data: { status: "canceled" },
    });
    return { success: true };
  }

  if (!flags.useMockStripe) {
    try {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();
      await (stripe.quotes as any).cancel(record.stripeQuoteId);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stripe API error";
      return { success: false, error: message };
    }
  }

  await prisma.quoteRecord.update({
    where: { id: quoteRecordId },
    data: { status: "canceled" },
  });

  await prisma.auditLog.create({
    data: {
      actorUserId: session.user.id,
      action: "quote.canceled",
      targetType: "stripe_quote",
      targetId: record.stripeQuoteId,
      payloadJson: { quoteRecordId },
    },
  });

  return { success: true };
}

export async function acceptQuote(
  acceptToken: string,
): Promise<{
  success: boolean;
  error?: string;
  redirectUrl?: string;
  dryRunLog?: string[];
}> {
  const record = await prisma.quoteRecord.findUnique({
    where: { acceptToken },
  });
  if (!record) return { success: false, error: "Quote not found." };
  if (record.status === "accepted") {
    return { success: false, error: "Quote has already been accepted." };
  }
  if (record.status !== "open" && record.status !== "dry_run") {
    return { success: false, error: `Cannot accept a quote in "${record.status}" status.` };
  }
  if (record.expiresAt && record.expiresAt < new Date()) {
    return { success: false, error: "This quote has expired." };
  }

  const isDryRun = record.dryRun;
  const actionLog: string[] = [];

  if (record.collectionMethod === "charge_automatically") {
    if (isDryRun) {
      actionLog.push(
        `[DRY RUN] Would create Stripe Checkout Session for quote ${record.stripeQuoteId}`,
      );
      actionLog.push(`[DRY RUN] Customer: ${record.stripeCustomerId}`);
      actionLog.push(`[DRY RUN] Mode: subscription (prepay path)`);
      actionLog.push(
        `[DRY RUN] Would redirect to Stripe Checkout for payment method collection`,
      );

      if (record.sfQuoteId) {
        const { updateSfQuoteStatus, closeOpportunityWon } = await import(
          "./sf-quote-mirror"
        );
        actionLog.push(
          ...(await updateSfQuoteStatus(record.sfQuoteId, "Accepted", true)),
        );
        if (record.opportunityId) {
          actionLog.push(
            ...(await closeOpportunityWon(
              record.opportunityId,
              record.totalAmount ?? 0,
              true,
            )),
          );
        }
      }

      return { success: true, dryRunLog: actionLog };
    }

    if (flags.useMockStripe) {
      actionLog.push(`[MOCK] Would create Checkout Session`);
      await prisma.quoteRecord.update({
        where: { id: record.id },
        data: { status: "accepted", acceptedAt: new Date() },
      });
      return { success: true, redirectUrl: "/accept/mock-success" };
    }

    try {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();

      const stripeQuote = await stripe.quotes.retrieve(record.stripeQuoteId, {
        expand: ["line_items"],
      } as any);
      const quoteLineItems = (stripeQuote as any).line_items?.data ?? [];

      const checkoutLineItems = quoteLineItems.map((qli: any) => ({
        price: qli.price?.id,
        quantity: qli.quantity,
      }));

      const hasRecurring = quoteLineItems.some(
        (qli: any) => qli.price?.recurring,
      );

      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: record.stripeCustomerId,
        line_items: checkoutLineItems,
        mode: hasRecurring ? "subscription" : "payment",
        payment_method_collection: "always",
        success_url: `${baseUrl}/accept/${acceptToken}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/accept/${acceptToken}?canceled=true`,
        metadata: {
          source: "displai_omni",
          quote_record_id: record.id,
          stripe_quote_id: record.stripeQuoteId,
        },
      });

      await prisma.quoteRecord.update({
        where: { id: record.id },
        data: { status: "pending_payment" },
      });

      return { success: true, redirectUrl: checkoutSession.url ?? undefined };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe error";
      return { success: false, error: message };
    }
  }

  if (record.collectionMethod === "send_invoice") {
    if (isDryRun) {
      actionLog.push(
        `[DRY RUN] Would accept Stripe quote ${record.stripeQuoteId}`,
      );
      actionLog.push(
        `[DRY RUN] Stripe will auto-create invoice with net terms: ${record.paymentTerms}`,
      );

      if (record.sfQuoteId) {
        const { updateSfQuoteStatus, closeOpportunityWon } = await import(
          "./sf-quote-mirror"
        );
        actionLog.push(
          ...(await updateSfQuoteStatus(record.sfQuoteId, "Accepted", true)),
        );
        if (record.opportunityId) {
          actionLog.push(
            ...(await closeOpportunityWon(
              record.opportunityId,
              record.totalAmount ?? 0,
              true,
            )),
          );
        }
      }

      return { success: true, dryRunLog: actionLog };
    }

    if (flags.useMockStripe) {
      await prisma.quoteRecord.update({
        where: { id: record.id },
        data: { status: "accepted", acceptedAt: new Date() },
      });
      return { success: true };
    }

    try {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();
      await (stripe.quotes as any).accept(record.stripeQuoteId);

      await prisma.quoteRecord.update({
        where: { id: record.id },
        data: { status: "accepted", acceptedAt: new Date() },
      });

      if (record.sfQuoteId) {
        const { updateSfQuoteStatus, closeOpportunityWon } = await import(
          "./sf-quote-mirror"
        );
        await updateSfQuoteStatus(record.sfQuoteId, "Accepted", false);
        if (record.opportunityId) {
          await closeOpportunityWon(
            record.opportunityId,
            record.totalAmount ?? 0,
            false,
          );
        }
      }

      return { success: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Stripe error";
      return { success: false, error: message };
    }
  }

  return { success: false, error: "Invalid collection method." };
}
