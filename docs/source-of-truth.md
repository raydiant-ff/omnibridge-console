# Omni Source-of-Truth Rules

When Stripe, Salesforce, and Omni disagree on the same data point, this file is the tiebreaker.

---

## Stripe is authoritative for

| Data | Canonical field | Notes |
|---|---|---|
| Subscription billing status | `StripeSubscription.status` | Never use `SfContract.stripeStatus` for billing state |
| Invoice amounts and status | `StripeInvoice.*` | |
| Payment status | `StripePayment.status` | |
| Payment method details | `StripePaymentMethod.*` | |
| Billing cycle / period dates | `StripeSubscription.currentPeriodStart/End` | |
| Cancellation timing (billing) | `StripeSubscription.cancelAt`, `canceledAt` | SF `cancellationDate` is commercial/CRM context |
| Discount status | `StripeSubscription.hasDiscount` | |
| Subscription item unit amounts | `StripeSubscriptionItem.unitAmount` | |

## Salesforce is authoritative for

| Data | Canonical field | Notes |
|---|---|---|
| Account name | `SfAccount.name` | Stripe customer name is a copy |
| Account ownership / CSM assignment | `SfAccount.ownerId/csmId` | |
| Commercial contract terms | `SfContract.startDate`, `endDate`, `contractTerm` | |
| Contract renewal flags | `SfContract.doNotRenew`, `evergreen`, `renewalTerm` | |
| Opportunity stage and pipeline | Salesforce live / `SfOpportunity` (when mirrored) | |
| Contact / signer details | `SfContact.*` | `QuoteRecord.signerName` is a copy taken at quote time |
| Commercial cancellation intent | `SfContract.cancellationDate` | Stripe `cancelAt` is billing execution |

## Omni is authoritative for

| Data | Canonical field | Notes |
|---|---|---|
| Quote lifecycle state | `QuoteRecord.status` | |
| Quote acceptance | `QuoteRecord.acceptedAt`, `acceptToken` | |
| Renewal workflow state | `Renewal.status` | Once `Renewal` model exists |
| CSM notes | `CustomerNote.body` | Once `CustomerNote` model exists |
| Health/risk signals | `AccountSignal.*` | Once `AccountSignal` model exists |
| Work items / tasks | `WorkItem.*` | |
| User actions | `AuditLog.*` | |

## Nobody owns (stale/computed — derive at query time)

| Data | Stored in | What to do instead |
|---|---|---|
| Days until contract expiry | `SfContract.daysTillExpiry` | Compute: `Math.floor((endDate - now) / 86400000)` |
| Subscription status on SF contract | `SfContract.stripeStatus` | Join to `StripeSubscription` on `stripeSubscriptionId` |
| MRR on SfContract | `SfContract.mrr` | Sum `SfContractLine.mrr` where active |

---

## The identity mapping problem

Three places claim to own the Stripe ↔ Salesforce account link:

1. `StripeCustomer.sfAccountId`
2. `SfAccount.stripeCustomerId`
3. `CustomerIndex.sfAccountId` + `CustomerIndex.stripeCustomerId`

**Rule: `CustomerIndex` is the canonical identity mapping.**

The mirror table fields (`StripeCustomer.sfAccountId`, `SfAccount.stripeCustomerId`) are denormalized caches written during sync. Do not use them for cross-system navigation — use `CustomerIndex` for lookups.

If `CustomerIndex` has no record for a given customer, that customer has not been linked across systems yet (expected for Stripe-only or SF-only accounts).

---

## MRR/ARR authoritativeness

| What you want | Where to get it |
|---|---|
| ARR for a single contract | Sum of active `SfContractLine.arr` for that contract |
| MRR for a single contract | Sum of active `SfContractLine.mrr` for that contract |
| ARR for a customer | Sum of active contracts' line ARR |
| ARR for portfolio | Raw SQL aggregate on `SfContractLine` with join to `SfContract.status = 'Activated'` |
| `SfContract.arr` | Cache only. Use as approximation, not truth. |

---

## Cancellation semantics

| Context | Use | Reason |
|---|---|---|
| Billing: did billing stop? | `StripeSubscription.canceledAt` | Stripe executed the cancellation |
| Commercial: was there intent? | `SfContract.cancellationDate` | SF recorded the commercial decision |
| UI: is subscription active? | `StripeSubscription.status` | Authoritative billing state |
| UI: is contract active? | `SfContract.status = 'Activated'` | Authoritative commercial state |

Both can be true simultaneously (commercial intent vs billing execution). Document this in UI when surfacing cancellation state.
