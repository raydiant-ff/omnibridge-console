# Schema Cleanup Candidates

Prioritized list of schema changes. Do NOT execute without migration plan and data verification.

---

## Priority 1 — Safe to do now (no data risk)

### Remove `QuoteRecord.pandadocDocId`
- **Status**: DONE — migration `20260314000000` dropped `pandadoc_document_id` column. Schema field removed. Zero code references.

### Add `WorkItemType` enum
- **Status**: DONE — `work_items.type` column migrated to `WorkItemType` enum in migration `20260316202006`. Data check confirmed 0 rows in `work_items`, so drop+recreate was safe.

### Add new product entities
- **Status**: DONE — `renewals`, `customer_notes`, `account_signals` tables added in migration `20260314000000`. Prisma relations active.

---

## Priority 2 — Requires data verification first

### `StripeInvoice.subscriptionId` → `StripeSubscription` FK relation
- **Status**: DONE — `stripe_invoices` table had 0 rows. FK added with `ON DELETE SET NULL` in migration `20260316202006`. Prisma relation now active. `InvoiceView.subscriptionId` comment updated.

### `QuoteRecord.customerId` → `CustomerIndex` FK relation
- **Status**: BLOCKED — data check run 2026-03-16, results:
  - Total `quote_records` rows: 53
  - Orphaned (customer_id not in customer_index): **53 of 53**
  - **All 53 rows have orphaned references.** The `customerId` values are NOT valid `CustomerIndex.id` values.
- **Root cause to investigate**: The `customer_id` values may be Stripe customer IDs, SF account IDs, or legacy internal IDs. No current product code joins on this field.
- **Required before FK**: A backfill job must populate correct `CustomerIndex.id` values for all 53 quote records, OR the field purpose must be clarified and possibly renamed.
- **Current workaround**: Use `stripeCustomerId` and `sfAccountId` fields on `QuoteRecord` for customer navigation. Both work today.

---

## Priority 3 — Deferred (refactor later)

### Remove `SfContract.daysTillExpiry`
- **Status**: QUERY LAYER DONE — all product-facing reads replaced with `computeDaysToExpiry()` as of 2026-03-16. The schema field still exists (for sync writes from SF) but no product query trusts it.
- **Remaining step**: Remove schema field + migration once sync code is audited. The sync action `sf-contract-sync.ts` still writes `daysTillExpiry: row.Days_Till_Expiry__c` to the mirror field — this write is acceptable (mirrors can store raw SF data). Field removal is purely cosmetic at this point.
- **Remaining exceptions (safe)**:
  - `sf-contract-sync.ts:119` — sync write to mirror, not a product read
  - `mock-data.ts` — hardcoded mock values, not wired to DB

### Remove `SfContract.stripeStatus`
- **Status**: DEFERRED
- **Blocker**: Used in `sf-contracts.ts` output mapping.
- **Plan**: Remove from output type, replace with joined `StripeSubscription.status` in `SubscriptionView` projection.
- **Do not remove until**: Projection layer is stable.

### Extract DocuSign tracking from `QuoteRecord`
- **Status**: DEFERRED
- **Issue**: `docusignEnvelopeId`, `signerName`, `signerEmail` are DocuSign state embedded in QuoteRecord.
- **Plan**: Create `DocuSignRecord` model linked to `QuoteRecord` with a `@unique` FK. Migrate data. Remove fields from `QuoteRecord`.
- **Not urgent**: Wait until DocuSign flows are mature and the need for separate querying is clear.

### Extract address fields from `QuoteRecord`
- **Status**: DEFERRED
- **Issue**: `billingAddressJson`, `shippingAddressJson` are JSON blobs.
- **Plan**: Structured address fields or a shared `Address` model.
- **Not urgent**: Only matters when address data is actively queried or displayed in complex ways.

### Merge `SyncEvent` + `ProductLog`
- **Status**: DEFERRED
- **Issue**: Overlapping purpose. Both log cross-system events with `source`, `action`, `actorType`.
- **Plan**: Consolidate into a single `SystemEvent` model in a future schema cleanup pass.
- **Not urgent**: Both tables are infrastructure-only.

---

## Do NOT touch

| Field/Model | Reason |
|---|---|
| `AuditLog` structure | Core audit trail. Any schema change risks breaking compliance/traceability. Additive changes only. |
| `IdempotencyKey` | Dedup mechanism. Breaking this causes duplicate billing side effects. |
| `StripeCustomer.sfAccountId` | Denormalized link used in sync code. Remove only after `CustomerIndex` is fully authoritative. |
| `SfAccount.stripeCustomerId` | Same reason. |
