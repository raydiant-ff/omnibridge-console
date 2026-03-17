import { randomUUID } from "crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getServerSession } from "@omnibridge/auth";
import { getRenewalDetail } from "@/lib/queries/cs-renewals";

function inferBillingFrequency(
  interval: string | null | undefined,
  intervalCount: number | undefined,
): string {
  if (!interval) return "monthly";
  if (interval === "year" && intervalCount === 1) return "annual";
  if (interval === "year" && intervalCount === 2) return "2yr";
  if (interval === "year" && intervalCount === 3) return "3yr";
  if (interval === "month" && intervalCount === 3) return "quarterly";
  if (interval === "month" && intervalCount === 6) return "semi_annual";
  return "monthly";
}

export async function POST(request: Request) {
  const session = await getServerSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { candidateId } = await request.json();
  if (!candidateId) {
    return NextResponse.json({ error: "Missing candidateId" }, { status: 400 });
  }

  const detail = await getRenewalDetail(decodeURIComponent(candidateId));
  if (!detail) {
    return NextResponse.json({ error: "Candidate not found" }, { status: 404 });
  }

  const { candidate: c, account } = detail;
  const draftId = randomUUID().slice(0, 12);

  const draft = {
    id: draftId,
    candidateId: c.candidateId,
    subscriptionId: c.id,
    customerId: c.customerId,
    customerName: c.customerName,
    csmName: c.csmName ?? account?.csmName ?? null,
    sfAccountId: c.contract?.accountId ?? account?.id ?? null,
    sfContractId: c.contract?.id ?? null,
    contractNumber: c.contract?.contractNumber ?? null,
    lineItems: c.items.map((item) => ({
      id: item.id,
      productName: item.productName,
      unitAmount: item.unitAmount,
      currency: item.currency,
      interval: item.interval,
      intervalCount: item.intervalCount,
      quantity: item.quantity,
      mrr: item.mrr,
      discount: 0,
      overrideUnitAmount: null as number | null,
    })),
    contractTerm: "1yr",
    billingFrequency: inferBillingFrequency(c.items[0]?.interval, c.items[0]?.intervalCount),
    collectionMethod: c.collectionMethod,
    effectiveDate: c.contract?.endDate ?? c.currentPeriodEnd.slice(0, 10),
    notes: "",
    createdAt: new Date().toISOString(),
  };

  const jar = await cookies();
  jar.set(`renewal-draft-${draftId}`, JSON.stringify(draft), {
    path: "/",
    maxAge: 60 * 60 * 24,
    httpOnly: true,
    sameSite: "lax",
  });

  return NextResponse.json({ draftId });
}
