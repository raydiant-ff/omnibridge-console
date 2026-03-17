import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@omnibridge/db";

export async function POST(req: NextRequest) {
  try {
    const { token } = (await req.json()) as { token?: string };
    if (!token) {
      return NextResponse.json({ error: "Missing token" }, { status: 400 });
    }

    const record = await prisma.quoteRecord.findUnique({
      where: { acceptToken: token },
    });

    if (!record) {
      return NextResponse.json({ error: "Quote not found" }, { status: 404 });
    }

    if (record.status === "accepted") {
      return NextResponse.json(
        { error: "Quote has already been accepted." },
        { status: 400 },
      );
    }

    if (
      record.status !== "open" &&
      record.status !== "signed" &&
      record.status !== "pending_payment"
    ) {
      return NextResponse.json(
        { error: `Cannot pay for a quote in "${record.status}" status.` },
        { status: 400 },
      );
    }

    if (record.expiresAt && record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This quote has expired." },
        { status: 400 },
      );
    }

    if (record.collectionMethod !== "charge_automatically") {
      return NextResponse.json(
        { error: "This quote does not require payment." },
        { status: 400 },
      );
    }

    if (record.dryRun) {
      return NextResponse.json(
        { error: "Cannot create checkout for dry-run quotes." },
        { status: 400 },
      );
    }

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

    const baseUrl =
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";

    const session = await stripe.checkout.sessions.create({
      customer: record.stripeCustomerId,
      line_items: checkoutLineItems,
      mode: hasRecurring ? "subscription" : "payment",
      ui_mode: "embedded",
      return_url: `${baseUrl}/accept/${token}/return?session_id={CHECKOUT_SESSION_ID}`,
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

    return NextResponse.json({ clientSecret: session.client_secret });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[Checkout Embedded] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
