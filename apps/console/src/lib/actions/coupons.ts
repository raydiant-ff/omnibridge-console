"use server";

import { requireSession } from "@omnibridge/auth";
import { invalidateTag } from "@/lib/cache";
import { flags } from "@/lib/feature-flags";

export interface CreateCouponInput {
  name: string;
  type: "percent" | "fixed";
  percentOff?: number;
  amountOff?: number;
  currency?: string;
  duration: "forever" | "once" | "repeating";
  durationInMonths?: number;
  maxRedemptions?: number;
  appliesToProducts?: string[];
}

export interface CreateCouponResult {
  success: boolean;
  error?: string;
  couponId?: string;
}

export async function createCoupon(
  input: CreateCouponInput,
): Promise<CreateCouponResult> {
  const session = await requireSession();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") {
    return { success: false, error: "Only admins can create coupons." };
  }

  if (!input.name.trim()) {
    return { success: false, error: "Coupon name is required." };
  }

  if (input.type === "percent") {
    if (!input.percentOff || input.percentOff <= 0 || input.percentOff > 100) {
      return { success: false, error: "Percent off must be between 1 and 100." };
    }
  } else {
    if (!input.amountOff || input.amountOff <= 0) {
      return { success: false, error: "Amount off must be greater than 0." };
    }
  }

  if (input.duration === "repeating" && (!input.durationInMonths || input.durationInMonths <= 0)) {
    return { success: false, error: "Duration in months is required for repeating coupons." };
  }

  if (flags.useMockStripe) {
    const mockId = `coup_mock_${Date.now().toString(36)}`;
    invalidateTag("stripe-coupons");
    return { success: true, couponId: mockId };
  }

  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();

    const params: Record<string, unknown> = {
      name: input.name.trim(),
      duration: input.duration,
      metadata: {
        source: "displai_omni",
        created_by: (session.user as { email?: string }).email ?? "unknown",
      },
    };

    if (input.type === "percent") {
      params.percent_off = input.percentOff;
    } else {
      params.amount_off = input.amountOff;
      params.currency = input.currency ?? "usd";
    }

    if (input.duration === "repeating" && input.durationInMonths) {
      params.duration_in_months = input.durationInMonths;
    }

    if (input.maxRedemptions && input.maxRedemptions > 0) {
      params.max_redemptions = input.maxRedemptions;
    }

    if (input.appliesToProducts && input.appliesToProducts.length > 0) {
      params.applies_to = { products: input.appliesToProducts };
    }

    const coupon = await stripe.coupons.create(params as any);
    invalidateTag("stripe-coupons");
    return { success: true, couponId: coupon.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return { success: false, error: message };
  }
}

export async function deleteCoupon(
  couponId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await requireSession();
  const role = (session.user as { role?: string }).role ?? "member";
  if (role !== "admin") {
    return { success: false, error: "Only admins can delete coupons." };
  }

  if (flags.useMockStripe) {
    invalidateTag("stripe-coupons");
    return { success: true };
  }

  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();
    await stripe.coupons.del(couponId);
    invalidateTag("stripe-coupons");
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return { success: false, error: message };
  }
}

export async function createInlineCoupon(
  name: string,
  type: "percent" | "fixed",
  value: number,
  currency: string = "usd",
): Promise<CreateCouponResult> {
  await requireSession();

  if (flags.useMockStripe) {
    return { success: true, couponId: `coup_inline_${Date.now().toString(36)}` };
  }

  try {
    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();

    const params: Record<string, unknown> = {
      name,
      duration: "once" as const,
      metadata: { source: "displai_omni", inline: "true" },
    };

    if (type === "percent") {
      params.percent_off = value;
    } else {
      params.amount_off = Math.round(value * 100);
      params.currency = currency;
    }

    const coupon = await stripe.coupons.create(params as any);
    return { success: true, couponId: coupon.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Stripe error";
    return { success: false, error: message };
  }
}
