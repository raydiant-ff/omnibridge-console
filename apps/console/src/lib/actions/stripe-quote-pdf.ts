"use server";

import { flags } from "@/lib/feature-flags";

export async function downloadStripeQuotePdf(
  stripeQuoteId: string,
): Promise<Buffer> {
  if (flags.useMockStripe || stripeQuoteId.startsWith("qt_dryrun_")) {
    return Buffer.from("%PDF-1.4 mock-stripe-quote-pdf", "utf-8");
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is not set");

  const url = `https://files.stripe.com/v1/quotes/${stripeQuoteId}/pdf`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${secretKey}` },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(
      `Failed to download Stripe quote PDF: ${response.status} ${text}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
