import { NextResponse } from "next/server";
import { getSubscriptionsDashboardData } from "@/lib/queries/subscriptions-dashboard";

export async function GET() {
  try {
    const data = await getSubscriptionsDashboardData();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[api/subscriptions-dashboard] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load subscription data." },
      { status: 500 },
    );
  }
}
