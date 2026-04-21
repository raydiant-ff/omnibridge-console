# Salesforce Quote Mirror Backfill Plan

## Goal

Have Salesforce CPQ quote metrics and account-level quote snapshots served from a local mirror in time for the March 25, 2026 demo window.

This plan is explicitly for **Salesforce quotes (`SBQQ__Quote__c`)**, not Omni/Stripe quote records.

## Current state

- `/cs` now treats Salesforce as the quote source of truth.
- Quote counts are being pulled live from Salesforce SOQL in [`apps/console/src/app/(app)/cs/actions.ts`](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/(app)/cs/actions.ts).
- We do **not** currently have a first-class local quote mirror table for `SBQQ__Quote__c`.
- The Salesforce sync cron currently mirrors:
  - `Contract`
  - `SBQQ__Subscription__c`
  - `Contact`
  - `Account`

## Fastest safe path for tomorrow

### 1. Add minimal quote mirror tables

Create:

- `sf_quotes`
  - `id`
  - `account_id`
  - `opportunity_id`
  - `name`
  - `status`
  - `net_amount`
  - `start_date`
  - `end_date`
  - `quote_type`
  - `is_primary`
  - `is_ordered`
  - `stripe_subscription_id`
  - `stripe_customer_id`
  - `sf_last_modified`
  - `synced_at`

- `sf_quote_lines` (optional tomorrow, recommended next)
  - only if we need line-level product views immediately

Tomorrow’s demo only needs **quote header coverage**, so `sf_quotes` is the priority.

### 2. Extend the Salesforce sync cron

Update [`apps/console/src/app/api/cron/sf-sync/route.ts`](/Users/franciscofiedler/OmniBridge-v2/apps/console/src/app/api/cron/sf-sync/route.ts) to:

- query `SBQQ__Quote__c`
- upsert into `sf_quotes`
- chunk by `LastModifiedDate DESC`
- keep the sync idempotent
- log a separate processed count for quotes

Suggested header field list:

```soql
Id,
Name,
SBQQ__Account__c,
SBQQ__Opportunity2__c,
SBQQ__Status__c,
SBQQ__NetAmount__c,
SBQQ__StartDate__c,
SBQQ__EndDate__c,
SBQQ__Type__c,
SBQQ__Primary__c,
SBQQ__Ordered__c,
Stripe_Subscription_ID__c,
Stripe_Customer_ID__c,
LastModifiedDate,
CreatedDate
```

### 3. Run a one-time backfill immediately after deploy

For tomorrow, do **one full quote backfill** after the new sync code lands.

Runbook:

1. deploy the cron sync change
2. invoke the Salesforce sync manually once
3. verify row counts in `sf_quotes`
4. verify `/cs` quote metrics against Salesforce live counts

### 4. Cut `/cs` from live SOQL to local mirror

After the backfill succeeds:

- switch `/cs` quote aggregates to read from `sf_quotes`
- keep the live-Salesforce fallback only as a temporary safety net

This will:

- reduce dashboard latency
- reduce Salesforce dependency during demos
- make quote metrics consistent across pages

### 5. Follow-up after tomorrow

After the demo window:

- add `sf_quote_lines`
- wire quote distributions and per-account line item detail from the mirror
- add incremental sync by `LastModifiedDate`
- add mirror health to the trust/freshness panel

## Definition of done for tomorrow

- `sf_quotes` exists and is populated
- Salesforce sync cron upserts quote headers
- one successful backfill has run
- `/cs` quote totals and accepted quote metrics can be served from the mirror
- no Omni quote fallback remains in dashboard semantics

## Risk notes

- Do **not** mix `Stripe_Quote__c` / Omni quote records into this mirror plan.
- Keep the mirror header-level only if time is tight.
- Favor a safe, visible backfill over a rushed line-level sync.
