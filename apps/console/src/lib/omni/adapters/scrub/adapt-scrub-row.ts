/**
 * Adapt canonical OmniScrubMonthlyAccount → route-edge ScrubRow.
 */

import type { OmniScrubMonthlyAccount } from "../../contracts";
import { centsToDollars } from "../shared/money";
import type { ScrubRow, ScrubSubscription } from "./types";

export function adaptScrubRow(row: OmniScrubMonthlyAccount): ScrubRow {
  const canceledArrDollars = centsToDollars(row.canceledArrCents);
  const snapshotArrDollars = centsToDollars(row.snapshotArrCents);
  const newArrDollars = centsToDollars(row.replacementArrCents);
  const netArrDollars = Math.round((newArrDollars - canceledArrDollars) * 100) / 100;
  const totalActiveArrDollars = Math.round((snapshotArrDollars + newArrDollars) * 100) / 100;

  function toScrubSub(
    ref: typeof row.canceledSubs[number],
    isNew?: boolean,
  ): ScrubSubscription {
    return {
      id: ref.id,
      status: ref.status,
      customerName: row.displayName,
      canceledAt: ref.canceledAt,
      createdAt: ref.createdAt ?? "",
      mrrCents: ref.mrrCents,
      ...(isNew ? { isNew: true } : {}),
    };
  }

  return {
    customerName: row.displayName,
    stripeCustomerId: row.stripeCustomerId,
    sfAccountId: null,
    canceledSubs: row.canceledSubs.map((s) => toScrubSub(s)),
    canceledArrDollars,
    snapshotSubs: row.snapshotSubs.map((s) => toScrubSub(s)),
    snapshotArrDollars,
    newSubs: row.newSubs.map((s) => toScrubSub(s, true)),
    newArrDollars,
    netArrDollars,
    totalActiveArrDollars,
    classification: row.classification,
  };
}
