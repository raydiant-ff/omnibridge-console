/**
 * Adapt canonical OmniRenewalCandidate → route-edge RenewalCandidate.
 */

import type { OmniRenewalCandidate } from "../../contracts";
import type {
  RenewalCandidate,
  LinkedContract,
  RenewalCandidateItem,
  Signal,
} from "./types";

export function adaptRenewalCandidate(c: OmniRenewalCandidate): RenewalCandidate {
  const contract: LinkedContract | null = c.contract
    ? {
        id: c.contract.id,
        accountId: c.contract.accountId,
        accountName: c.contract.accountName,
        contractNumber: c.contract.contractNumber,
        status: c.contract.status,
        startDate: c.contract.startDate,
        endDate: c.contract.endDate,
        contractTerm: c.contract.contractTerm,
        ownerName: c.contract.ownerName,
        mrr: c.contract.mrrApprox,
        arr: c.contract.arrApprox,
        evergreen: c.contract.evergreen,
        doNotRenew: c.contract.doNotRenew,
        daysTillExpiry: c.contract.daysToExpiry,
        collectionMethod: c.contract.collectionMethod,
        lineCount: c.contract.lineCount,
      }
    : null;

  const items: RenewalCandidateItem[] = c.items.map((i) => ({
    id: i.id,
    productName: i.productName,
    unitAmount: i.unitAmountCents,
    currency: i.currency,
    interval: i.billingInterval,
    intervalCount: i.intervalCount,
    quantity: i.quantity,
    mrr: i.mrrCents,
  }));

  let signal: Signal;
  if (c.daysToRenewal !== null && c.daysToRenewal < 0) signal = "past_due";
  else if (c.daysToRenewal !== null && c.daysToRenewal <= 7) signal = "due_soon";
  else signal = "upcoming";

  return {
    id: c.subscriptionId ?? c.sfContractId ?? c.candidateId,
    candidateId: c.candidateId,
    customerId: c.omniAccountId,
    customerName: c.customerName,
    csmName: c.csmName,
    status: c.subscriptionStatus ?? c.contract?.status ?? c.status,
    renewalStatus: c.status,
    signal,
    mrr: c.mrrCents,
    currency: "usd",
    currentPeriodEnd: c.renewalDate,
    cancelAt: null,
    cancelAtPeriodEnd: c.status === "cancelling",
    hasSchedule: c.status === "scheduled_end",
    collectionMethod: c.billingMode,
    items,
    metadata: {},
    contract,
    dueDate: c.renewalDate,
    dueBasis: "contract",
    subscriptionStatus: c.subscriptionStatus,
  };
}
