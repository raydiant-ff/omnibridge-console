# Omni Schema Architecture Map

Every model classified. Read this before building any product screen.

---

## Layer definitions

| Layer | Rule |
|---|---|
| **Infrastructure** | Never query directly from product UI. Auth, dedup, audit. |
| **Mirror** | Read-only caches of Stripe/Salesforce objects. Always potentially stale. Never mutate from product. |
| **Identity** | Cross-system mapping only. Not a domain entity. |
| **Product** | Omni-owned workflow and state. Safe to build UI directly on. |
| **Transitional** | Contains mixed concerns or legacy contamination. Use with explicit guardrails. |

---

## Model inventory

### Infrastructure

| Model | Table | Notes |
|---|---|---|
| `Account` | `accounts` | NextAuth OAuth adapter. Never touch. |
| `Session` | `sessions` | NextAuth session store. Never touch. |
| `VerificationToken` | `verification_tokens` | NextAuth. Never touch. |
| `IdempotencyKey` | `idempotency_keys` | Webhook/action dedup. Internal only. |
| `SyncJob` | `sync_jobs` | Batch sync tracking. Admin/ops only. |
| `SyncEvent` | `sync_events` | Per-event sync log. Internal only. |
| `ProductLog` | `product_logs` | Product object change log (Stripe). Internal only. |
| `AuditLog` | `audit_log` | User/system action trail. Admin views only; always scope by targetType + time range. |

### Mirror (read-only caches)

| Model | Table | Source | Stale risk |
|---|---|---|---|
| `StripeCustomer` | `stripe_customers` | Stripe | Medium. Check `syncedAt`. |
| `StripeProduct` | `stripe_products` | Stripe | Low. Products change rarely. |
| `StripePrice` | `stripe_prices` | Stripe | Low. |
| `StripeSubscription` | `stripe_subscriptions` | Stripe | Medium. Check `syncedAt`. |
| `StripeSubscriptionItem` | `stripe_subscription_items` | Stripe | Medium. |
| `StripeInvoice` | `stripe_invoices` | Stripe | Medium. |
| `StripePayment` | `stripe_payments` | Stripe | Medium. |
| `StripePaymentMethod` | `stripe_payment_methods` | Stripe | Low. |
| `SfAccount` | `sf_accounts` | Salesforce | **High. Contains stubs (`isStub=true`). Always filter.** |
| `SfContract` | `sf_contracts` | Salesforce | **High. `daysTillExpiry` and `stripeStatus` are stale-prone.** |
| `SfContractLine` | `sf_contract_lines` | Salesforce | Medium. |
| `SfContact` | `sf_contacts` | Salesforce | Low. |

### Identity

| Model | Table | Notes |
|---|---|---|
| `CustomerIndex` | `customer_index` | Cross-system identity mapping only. Maps `sfAccountId` ↔ `stripeCustomerId`. Do **not** treat as a customer domain entity. |

### Product (safe to build UI on)

| Model | Table | Notes |
|---|---|---|
| `User` | `users` | Internal operators. Auth + role. |
| `WorkItem` | `work_items` | Task/workflow items. `type` is untyped string — see cleanup candidates. |

### Transitional / legacy-contaminated

| Model | Table | Issues |
|---|---|---|
| `QuoteRecord` | `quote_records` | 7 mixed concerns (quote + DocuSign + contract terms + subscription links + CPQ + addresses). `pandadocDocId` is a dead field from removed integration. `customerId` is a bare string with no FK. |
| `SfContract` | `sf_contracts` | Is both a mirror AND stores computed BI (`mrr`, `arr`, `daysTillExpiry`). `daysTillExpiry` will go stale. `stripeStatus` should never be preferred over `StripeSubscription.status`. |
| `SfAccount` | `sf_accounts` | Contains stub records from backfill. `isStub=true` rows are known-incomplete. |

---

## Dangerous fields

| Field | Model | Danger |
|---|---|---|
| `daysTillExpiry` | `SfContract` | Stored computed value from a date. Will be wrong if not kept live. **Never display raw. Always compute from `endDate`.** |
| `stripeStatus` | `SfContract` | Stale Stripe status cache. **Always prefer `StripeSubscription.status` for billing state.** |
| `pandadocDocId` | `QuoteRecord` | Dead field. PandaDoc integration was removed. Field is pending removal. |
| `customerId` | `QuoteRecord` | Bare string with no Prisma `@relation`. Not enforced as FK to `CustomerIndex`. |
| `isStub` | `SfAccount` | Flags incomplete placeholder records. **All product queries must filter `isStub: false`.** |
| `mrr`/`arr` | `SfContract` AND `SfContractLine` | Duplicated with no enforcement of which is authoritative. `SfContractLine` sum is more reliable. |

---

## Missing domain entities

These do not exist and cannot be properly modeled with the current schema:

| Entity | Priority | Blocks |
|---|---|---|
| `Renewal` | P1 | Renewals workspace |
| `CustomerNote` | P2 | Customer 360 |
| `AccountSignal` | P2 | Health/risk views |
| `SfOpportunity` (mirror) | P2 | Opportunity workspace (currently all live Salesforce) |

---

## Query guardrails (enforced in `lib/repo/`)

- `SfAccount` queries: always pass `...SF_ACCOUNT_BASE_WHERE` (`isStub: false`)
- `SfContract.daysTillExpiry`: never read directly — use `computeDaysToExpiry(endDate)` from `lib/repo/derived.ts`
- `SfContract.stripeStatus`: never use for billing state — use `StripeSubscription.status`
- Mirror freshness: check `syncedAt` when displaying time-sensitive financial data
