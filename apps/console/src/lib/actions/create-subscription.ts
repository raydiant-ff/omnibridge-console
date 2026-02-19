"use server";

import { randomUUID } from "crypto";
import { prisma } from "@omnibridge/db";
import { requireSession } from "@omnibridge/auth";
import { flags } from "@/lib/feature-flags";

export interface LineItem {
  priceId: string;
  nickname: string;
  unitAmount: number;
  currency: string;
  interval: string;
  quantity: number;
}

export interface CreateSubscriptionInput {
  customerId: string;
  stripeCustomerId: string;
  customerName: string;
  lineItems: LineItem[];
  startDate: string;
  endDate: string;
  billingMode: "now" | "future";
  billingDate?: string;
  idempotencyKey: string;
}

export interface CreateSubscriptionResult {
  success: boolean;
  error?: string;
  workItemId?: string;
  stripeScheduleId?: string;
  stripeSubscriptionId?: string;
  auditLogId?: string;
}

async function releaseKey(key: string) {
  await prisma.idempotencyKey.delete({ where: { key } }).catch(() => {});
}

export async function executeCreateSubscription(
  input: CreateSubscriptionInput,
): Promise<CreateSubscriptionResult> {
  const session = await requireSession();
  const userId = session.user.id;
  const requestId = randomUUID();

  // ── Idempotency check ─────────────────────────────────────────────────
  const existingKey = await prisma.idempotencyKey.findUnique({
    where: { key: input.idempotencyKey },
  });

  if (existingKey) {
    const existingWorkItem = await prisma.workItem.findFirst({
      where: {
        type: "create_subscription",
        customerId: input.customerId,
        payloadJson: { path: ["idempotencyKey"], equals: input.idempotencyKey },
      },
    });

    if (existingWorkItem) {
      const payload = existingWorkItem.payloadJson as Record<string, unknown> | null;
      return {
        success: true,
        workItemId: existingWorkItem.id,
        stripeScheduleId: (payload?.stripeScheduleId as string) ?? undefined,
        stripeSubscriptionId: (payload?.stripeSubscriptionId as string) ?? undefined,
      };
    }
  }

  // ── Reserve idempotency key ───────────────────────────────────────────
  try {
    await prisma.idempotencyKey.create({
      data: {
        key: input.idempotencyKey,
        scope: "create_subscription",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
  } catch {
    return { success: false, error: "Duplicate request detected. Please wait and retry." };
  }

  // ── Input validation ──────────────────────────────────────────────────
  const nowTs = Math.floor(Date.now() / 1000);
  const startTs = Math.floor(new Date(input.startDate).getTime() / 1000);
  const endTs = Math.floor(new Date(input.endDate).getTime() / 1000);

  if (!Number.isFinite(startTs) || !Number.isFinite(endTs)) {
    await releaseKey(input.idempotencyKey);
    return { success: false, error: "Invalid start or end date." };
  }
  if (endTs <= startTs) {
    await releaseKey(input.idempotencyKey);
    return { success: false, error: "End date must be after start date." };
  }
  if (input.lineItems.length === 0) {
    await releaseKey(input.idempotencyKey);
    return { success: false, error: "At least one price is required." };
  }

  let billTs: number | null = null;
  if (input.billingMode === "future") {
    if (!input.billingDate) {
      await releaseKey(input.idempotencyKey);
      return { success: false, error: "Billing date is required for future billing." };
    }
    billTs = Math.floor(new Date(input.billingDate).getTime() / 1000);
    if (!Number.isFinite(billTs)) {
      await releaseKey(input.idempotencyKey);
      return { success: false, error: "Invalid billing date." };
    }
    if (billTs < nowTs) {
      await releaseKey(input.idempotencyKey);
      return { success: false, error: "Billing date must be in the future." };
    }
    if (billTs > endTs) {
      await releaseKey(input.idempotencyKey);
      return { success: false, error: "Billing date cannot be after end date." };
    }
  }

  // ── Call Stripe (or mock) ─────────────────────────────────────────────
  let stripeScheduleId = "";
  let stripeSubscriptionId = "";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let scheduleParams: Record<string, any> | null = null;

  if (flags.useMockStripe) {
    stripeScheduleId = `sub_sched_mock_${randomUUID().slice(0, 8)}`;
    stripeSubscriptionId = `sub_mock_${randomUUID().slice(0, 8)}`;
  } else {
    try {
      const { getStripeClient } = await import("@omnibridge/stripe");
      const stripe = getStripeClient();

      const phaseItems = input.lineItems.map((li) => ({
        price: li.priceId,
        quantity: li.quantity,
      }));

      // trial_end is a phase-level param per Stripe docs:
      // "Sets the phase to trialing from the start date to this date."
      // billing_cycle_anchor is an enum ("phase_start"|"automatic"), NOT a timestamp.
      const phase: Record<string, unknown> = {
        start_date: startTs,
        end_date: endTs,
        items: phaseItems,
        proration_behavior: "none" as const,
      };

      if (billTs) {
        phase.trial_end = billTs;
      }

      scheduleParams = {
        customer: input.stripeCustomerId,
        start_date: startTs,
        end_behavior: "cancel",
        phases: [phase],
      };

      const schedule = await stripe.subscriptionSchedules.create(
        scheduleParams,
        { idempotencyKey: input.idempotencyKey },
      );

      stripeScheduleId = schedule.id;
      stripeSubscriptionId = schedule.subscription
        ? typeof schedule.subscription === "string"
          ? schedule.subscription
          : schedule.subscription.id
        : "";
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Stripe API error";
      await releaseKey(input.idempotencyKey);
      return { success: false, error: message };
    }
  }

  // ── Persist work item + audit log ─────────────────────────────────────
  const workItem = await prisma.workItem.create({
    data: {
      type: "create_subscription",
      status: "completed",
      customerId: input.customerId,
      createdById: userId,
      payloadJson: JSON.parse(JSON.stringify({
        idempotencyKey: input.idempotencyKey,
        stripeScheduleId,
        stripeSubscriptionId,
        stripeCustomerId: input.stripeCustomerId,
        customerName: input.customerName,
        lineItems: input.lineItems,
        startDate: input.startDate,
        endDate: input.endDate,
        billingMode: input.billingMode,
        billingDate: input.billingDate ?? null,
      })),
    },
  });

  const auditLog = await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      action: "subscription.created",
      targetType: "stripe_subscription_schedule",
      targetId: stripeScheduleId,
      requestId,
      customerId: input.customerId,
      payloadJson: JSON.parse(JSON.stringify({
        workItemId: workItem.id,
        stripeScheduleId,
        stripeSubscriptionId,
        scheduleParams: scheduleParams ?? { mock: true },
        lineItems: input.lineItems.map((li) => ({
          priceId: li.priceId,
          nickname: li.nickname,
          quantity: li.quantity,
        })),
        startDate: input.startDate,
        endDate: input.endDate,
        billingMode: input.billingMode,
        billingDate: input.billingDate ?? null,
      })),
    },
  });

  return {
    success: true,
    workItemId: workItem.id,
    stripeScheduleId,
    stripeSubscriptionId,
    auditLogId: auditLog.id,
  };
}
