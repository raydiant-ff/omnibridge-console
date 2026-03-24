/**
 * Builder: Omni Renewal Candidate Detail
 *
 * Loads a single renewal candidate by candidateId with full detail
 * (contract lines, account info). Used by the detail pane.
 */

import { prisma } from "@omnibridge/db";
import { computeItemMrr } from "@/lib/billing-utils";
import { computeDaysToExpiry } from "@/lib/repo";
import { computeFreshness } from "../contracts/shared-types";
import type {
  OmniRenewalCandidate,
  RenewalCandidateStatus,
  RenewalCandidateItem,
  LinkedContractInfo,
  BillingMode,
  RenewalPriorityBucket,
  RiskReason,
} from "../contracts/omni-renewal-candidates";
import type { ConfidenceFlagEntry } from "../contracts/shared-types";

// ---------------------------------------------------------------------------
// Detail types (contract lines + account)
// ---------------------------------------------------------------------------

export interface OmniRenewalContractLine {
  id: string;
  productName: string | null;
  quantity: number | null;
  listPrice: number | null;
  netPrice: number | null;
  mrr: number | null;
  billingFrequency: string | null;
  startDate: string | null;
  endDate: string | null;
  status: string | null;
  stripePriceId: string | null;
  stripeSubItemId: string | null;
}

export interface OmniRenewalAccount {
  id: string;
  name: string;
  domain: string | null;
  ownerName: string | null;
  csmName: string | null;
  accountType: string | null;
  industry: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingCountry: string | null;
  stripeCustomerId: string | null;
}

export interface OmniRenewalDetailData {
  candidate: OmniRenewalCandidate;
  contractLines: OmniRenewalContractLine[];
  account: OmniRenewalAccount | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function classifyStatus(sub: {
  cancelAtPeriodEnd: boolean;
  cancelAt: Date | null;
  hasSchedule: boolean;
}): RenewalCandidateStatus {
  if (sub.cancelAtPeriodEnd || sub.cancelAt) return "cancelling";
  if (sub.hasSchedule) return "scheduled_end";
  return "period_ending";
}

function computePriorityBucket(days: number | null): RenewalPriorityBucket {
  if (days === null) return "on_track";
  if (days < 0) return "overdue";
  if (days === 0) return "due_today";
  if (days <= 7) return "due_soon";
  return "on_track";
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export async function buildOmniRenewalDetail(
  candidateId: string,
): Promise<OmniRenewalDetailData | null> {
  const [type, ...rest] = candidateId.split(":");
  const rawId = rest.join(":");
  if (!rawId) return null;

  // Compute freshness once
  const freshnessRows = await prisma.$queryRawUnsafe<{ max_synced: Date | null }[]>(
    `SELECT MAX(synced_at) AS max_synced FROM stripe_subscriptions`,
  );
  const freshness = computeFreshness(freshnessRows[0]?.max_synced ?? null);

  if (type === "sub") {
    const sub = await prisma.stripeSubscription.findUnique({
      where: { id: rawId },
      include: { items: true },
    });
    if (!sub) return null;

    const contract = await prisma.sfContract.findFirst({
      where: { stripeSubscriptionId: rawId },
      include: {
        lines: { orderBy: { productName: "asc" } },
        account: {
          select: {
            id: true, name: true, domain: true, ownerName: true,
            csmName: true, accountType: true, industry: true,
            billingCity: true, billingState: true, billingCountry: true,
            stripeCustomerId: true,
          },
        },
      },
    });

    // Resolve omniAccountId
    const ci = await prisma.customerIndex.findFirst({
      where: { stripeCustomerId: sub.customerId },
      select: { id: true },
    });

    const status = classifyStatus(sub);
    const dueDate = contract?.endDate
      ? contract.endDate.toISOString().slice(0, 10)
      : sub.currentPeriodEnd.toISOString().slice(0, 10);
    const daysToRenewal = computeDaysToExpiry(contract?.endDate ?? sub.currentPeriodEnd);

    // MRR: subscription items → contract lines → zero
    const subMrr = sub.items.reduce(
      (sum, si) => sum + computeItemMrr(si.unitAmount, si.billingInterval, si.intervalCount, si.quantity), 0);
    const lineMrr = contract?.lines.reduce((sum, l) => sum + (l.mrr ?? 0), 0) ?? 0;
    const mrrCents = subMrr > 0 ? subMrr : lineMrr > 0 ? Math.round(lineMrr * 100) : 0;

    const items: RenewalCandidateItem[] = sub.items.map((si) => ({
      id: si.id,
      productName: si.productName,
      unitAmountCents: si.unitAmount,
      currency: si.currency,
      billingInterval: si.billingInterval,
      intervalCount: si.intervalCount,
      quantity: si.quantity,
      mrrCents: computeItemMrr(si.unitAmount, si.billingInterval, si.intervalCount, si.quantity),
    }));

    const contractInfo: LinkedContractInfo | null = contract ? {
      id: contract.id,
      accountId: contract.accountId,
      accountName: contract.accountName,
      contractNumber: contract.contractNumber,
      status: contract.status,
      startDate: contract.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
      contractTerm: contract.contractTerm,
      ownerName: contract.ownerName,
      mrrApprox: contract.mrr,
      arrApprox: contract.arr,
      evergreen: contract.evergreen,
      doNotRenew: contract.doNotRenew,
      daysToExpiry: computeDaysToExpiry(contract.endDate),
      collectionMethod: contract.collectionMethod,
      lineCount: contract.lines.length,
    } : null;

    // Confidence flags
    const flags: ConfidenceFlagEntry[] = [];
    if (subMrr === 0 && lineMrr > 0) flags.push({ flag: "mrr_from_contract_lines", detail: "MRR sourced from SF contract lines" });
    if (mrrCents === 0) flags.push({ flag: "mrr_is_zero", detail: "No MRR from any source" });
    if (!contract) flags.push({ flag: "no_sf_contract", detail: "No SF contract linked" });

    // Risk
    let worstRiskReason: RiskReason | null = null;
    if (sub.status === "past_due") worstRiskReason = "past_due_subscription";
    else if (status === "cancelling") worstRiskReason = "cancelling";
    else if (contract?.doNotRenew) worstRiskReason = "do_not_renew";

    const candidate: OmniRenewalCandidate = {
      candidateId,
      omniAccountId: ci?.id ?? sub.customerId,
      customerName: sub.customerName,
      csmName: contract?.account?.csmName ?? null,
      sfContractId: contract?.id ?? null,
      subscriptionId: sub.id,
      billingMode: sub.collectionMethod as BillingMode,
      items,
      renewalDate: dueDate,
      daysToRenewal,
      mrrCents,
      arrCents: mrrCents * 12,
      status,
      subscriptionStatus: sub.status,
      worstRiskReason,
      priorityBucket: computePriorityBucket(daysToRenewal),
      contract: contractInfo,
      freshness,
      confidenceFlags: flags,
    };

    const contractLines: OmniRenewalContractLine[] = (contract?.lines ?? []).map((l) => ({
      id: l.id,
      productName: l.productName,
      quantity: l.quantity,
      listPrice: l.listPrice,
      netPrice: l.netPrice,
      mrr: l.mrr,
      billingFrequency: l.billingFrequency,
      startDate: l.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: l.endDate?.toISOString().slice(0, 10) ?? null,
      status: l.status,
      stripePriceId: l.stripePriceId,
      stripeSubItemId: l.stripeSubItemId,
    }));

    return {
      candidate,
      contractLines,
      account: contract?.account ?? null,
    };
  }

  if (type === "contract") {
    const contract = await prisma.sfContract.findUnique({
      where: { id: rawId },
      include: {
        lines: { orderBy: { productName: "asc" } },
        account: {
          select: {
            id: true, name: true, domain: true, ownerName: true,
            csmName: true, accountType: true, industry: true,
            billingCity: true, billingState: true, billingCountry: true,
            stripeCustomerId: true,
          },
        },
      },
    });
    if (!contract) return null;

    // Resolve omniAccountId
    const ci = await prisma.customerIndex.findFirst({
      where: { sfAccountId: contract.accountId },
      select: { id: true },
    });

    let subItems: RenewalCandidateItem[] = [];
    let subStatus = contract.status;
    let subCollectionMethod = contract.collectionMethod ?? "charge_automatically";
    let subCustomerId = contract.stripeCustomerId ?? contract.accountId;
    let subMrr = 0;
    let renewalStatus: RenewalCandidateStatus = "period_ending";

    if (contract.stripeSubscriptionId) {
      const sub = await prisma.stripeSubscription.findUnique({
        where: { id: contract.stripeSubscriptionId },
        include: { items: true },
      });
      if (sub) {
        subStatus = sub.status;
        subCollectionMethod = sub.collectionMethod;
        subCustomerId = sub.customerId;
        renewalStatus = classifyStatus(sub);
        subItems = sub.items.map((si) => ({
          id: si.id,
          productName: si.productName,
          unitAmountCents: si.unitAmount,
          currency: si.currency,
          billingInterval: si.billingInterval,
          intervalCount: si.intervalCount,
          quantity: si.quantity,
          mrrCents: computeItemMrr(si.unitAmount, si.billingInterval, si.intervalCount, si.quantity),
        }));
        subMrr = subItems.reduce((sum, si) => sum + si.mrrCents, 0);
      }
    }

    // MRR: subscription → contract lines → zero
    const lineMrr = contract.lines.reduce((sum, l) => sum + (l.mrr ?? 0), 0);
    const mrrCents = subMrr > 0 ? subMrr : lineMrr > 0 ? Math.round(lineMrr * 100) : 0;

    const dueDate = contract.endDate?.toISOString().slice(0, 10) ?? "";
    const daysToRenewal = computeDaysToExpiry(contract.endDate);

    const flags: ConfidenceFlagEntry[] = [];
    if (subMrr === 0 && lineMrr > 0) flags.push({ flag: "mrr_from_contract_lines", detail: "MRR sourced from SF contract lines" });
    if (mrrCents === 0) flags.push({ flag: "mrr_is_zero", detail: "No MRR from any source" });

    let worstRiskReason: RiskReason | null = null;
    if (subStatus === "past_due") worstRiskReason = "past_due_subscription";
    else if (contract.doNotRenew) worstRiskReason = "do_not_renew";

    const candidate: OmniRenewalCandidate = {
      candidateId,
      omniAccountId: ci?.id ?? subCustomerId,
      customerName: contract.accountName ?? "Unknown",
      csmName: contract.account?.csmName ?? null,
      sfContractId: contract.id,
      subscriptionId: contract.stripeSubscriptionId,
      billingMode: subCollectionMethod as BillingMode,
      items: subItems,
      renewalDate: dueDate,
      daysToRenewal,
      mrrCents,
      arrCents: mrrCents * 12,
      status: renewalStatus,
      subscriptionStatus: subStatus !== contract.status ? subStatus : null,
      worstRiskReason,
      priorityBucket: computePriorityBucket(daysToRenewal),
      contract: {
        id: contract.id,
        accountId: contract.accountId,
        accountName: contract.accountName,
        contractNumber: contract.contractNumber,
        status: contract.status,
        startDate: contract.startDate?.toISOString().slice(0, 10) ?? null,
        endDate: contract.endDate?.toISOString().slice(0, 10) ?? null,
        contractTerm: contract.contractTerm,
        ownerName: contract.ownerName,
        mrrApprox: contract.mrr,
        arrApprox: contract.arr,
        evergreen: contract.evergreen,
        doNotRenew: contract.doNotRenew,
        daysToExpiry: daysToRenewal,
        collectionMethod: contract.collectionMethod,
        lineCount: contract.lines.length,
      },
      freshness,
      confidenceFlags: flags,
    };

    const contractLines: OmniRenewalContractLine[] = contract.lines.map((l) => ({
      id: l.id,
      productName: l.productName,
      quantity: l.quantity,
      listPrice: l.listPrice,
      netPrice: l.netPrice,
      mrr: l.mrr,
      billingFrequency: l.billingFrequency,
      startDate: l.startDate?.toISOString().slice(0, 10) ?? null,
      endDate: l.endDate?.toISOString().slice(0, 10) ?? null,
      status: l.status,
      stripePriceId: l.stripePriceId,
      stripeSubItemId: l.stripeSubItemId,
    }));

    return {
      candidate,
      contractLines,
      account: contract.account ?? null,
    };
  }

  return null;
}
