import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    const sessionId = req.nextUrl.searchParams.get("session_id");
    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing session_id" },
        { status: 400 },
      );
    }

    const { getStripeClient } = await import("@omnibridge/stripe");
    const stripe = getStripeClient();

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    return NextResponse.json({
      status: session.status,
      customer_email:
        session.customer_details?.email ?? session.customer_email ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal error";
    console.error("[Checkout Status] Error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
