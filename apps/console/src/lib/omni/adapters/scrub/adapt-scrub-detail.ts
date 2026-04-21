/**
 * Adapt canonical OmniScrubAccountDetail → route-edge ScrubDetailData.
 */

import type { OmniScrubAccountDetail } from "../../contracts";
import { centsToDollars } from "../shared/money";
import type {
  ScrubDetailData,
  CanceledSubDetail,
  ActiveSubDetail,
  SubItemDetail,
  CoverageInfo,
} from "./types";

function adaptSubItem(item: {
  id: string;
  productName: string;
  quantity: number;
  unitAmountCents: number;
  billingInterval: string | null;
  intervalCount: number;
  arrCents: number;
  sfContractLineId: string | null;
  correlationStatus: string | null;
}): SubItemDetail {
  return {
    id: item.id,
    productName: item.productName,
    quantity: item.quantity,
    unitAmountCents: item.unitAmountCents,
    billingInterval: item.billingInterval,
    intervalCount: item.intervalCount,
    arrDollars: centsToDollars(item.arrCents),
    sfContractLineId: item.sfContractLineId,
    correlationStatus: item.correlationStatus,
  };
}

export function adaptScrubDetail(detail: OmniScrubAccountDetail): ScrubDetailData {
  const canceledSubscriptions: CanceledSubDetail[] = detail.canceledSubscriptions.map((c) => ({
    subId: c.subId,
    canceledAt: c.canceledAt,
    startDate: c.startDate,
    items: c.items.map(adaptSubItem),
    arrDollars: centsToDollars(c.arrCents),
    coverage: c.coverage as CoverageInfo,
  }));

  const activeSubscriptions: ActiveSubDetail[] = detail.activeSubscriptions.map((a) => ({
    subId: a.subId,
    status: a.status,
    startDate: a.startDate,
    currentPeriodEnd: a.currentPeriodEnd,
    arrDollars: centsToDollars(a.arrCents),
    sfContractId: a.sfContractId,
    sfContractStatus: a.sfContractStatus,
    sfMatchStatus: a.sfMatchStatus,
    items: a.items.map(adaptSubItem),
  }));

  return {
    customerName: detail.summary.customerName,
    stripeCustomerId: detail.summary.stripeCustomerId,
    scrubMonth: detail.summary.scrubMonth,
    snapshotDate: detail.summary.snapshotDate,
    freshness: detail.freshness,
    canceledSubscriptions,
    activeSubscriptions,
  };
}
