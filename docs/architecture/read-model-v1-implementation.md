# Omni Read-Model — Implementation-Ready v1

This refines the architecture in `read-model-architecture.md` into an exact implementation plan. Read that document first for the full reasoning.

---

## Refinement 1: Entity Linking Model

The wide `entity_links` table from the original design had too many nullable columns. Replace it with a simple pair-based model.

### New design: `entity_link` table

```
entity_link
  id              TEXT PK
  source_system   TEXT NOT NULL      -- 'salesforce', 'stripe'
  source_type     TEXT NOT NULL      -- 'account', 'customer', 'product', 'opportunity'
  source_id       TEXT NOT NULL      -- the external ID in the source system
  target_system   TEXT NOT NULL      -- the other system
  target_type     TEXT NOT NULL      -- entity type in target system
  target_id       TEXT NOT NULL      -- the external ID in the target system
  confidence      TEXT DEFAULT 'high'  -- 'high', 'medium', 'manual'
  link_source     TEXT NOT NULL      -- how the link was created: 'metadata', 'custom_field', 'manual', 'sync'
  created_at      TIMESTAMPTZ
  updated_at      TIMESTAMPTZ
  UNIQUE (source_system, source_type, source_id, target_system, target_type, target_id)
```

**Examples:**

| source_system | source_type | source_id | target_system | target_type | target_id | link_source |
|---|---|---|---|---|---|---|
| salesforce | account | 001xxx | stripe | customer | cus_xxx | metadata |
| stripe | product | prod_xxx | salesforce | product | 01tyyy | metadata |
| salesforce | opportunity | 006xxx | stripe | subscription | sub_zzz | sync |

**However** — for v1, we don't actually need this table yet. The denormalized FK columns on the mirror tables (`sf_accounts.stripe_customer_id`, `stripe_customers.sf_account_id`) handle the primary use case. Build `entity_link` only when you need:
- 1:many mappings (one SF account → multiple Stripe customers)
- Audit trail of link changes
- Confidence-based matching

**v1 decision: Skip `entity_link` table. Use FK columns on mirror tables. Add `entity_link` in Phase 2 if needed.**

---

## Refinement 2: sync_events — Audit Log, Not Queue

`sync_events` is an **append-only audit log**, not a processing queue.

- Webhook handlers and cron jobs write to `sync_events` **after** processing, recording what happened.
- It is not read during normal request processing.
- It exists for debugging, replay, and compliance.
- If processing fails, the error is recorded in `sync_events` AND in `sync_jobs`.

**The processing queue is `sync_jobs`** — it tracks running/pending/failed jobs and their cursors. If a cron job fails partway through, the cursor in `sync_jobs` tells the next run where to resume.

**v1 decision: `sync_events` is write-only audit. `sync_jobs` is the operational state tracker.**

---

## Refinement 3: No Materialized Views in v1

Regular SQL views and well-indexed queries are sufficient for v1. Materialized views add operational complexity (refresh scheduling, stale data windows, index management).

**v1 decision:** Use regular `VIEW`s only. Measure query performance after tables are populated. Add `MATERIALIZED VIEW` + refresh cron only if a specific query exceeds 500ms.

---

## Refinement 4: Field-Level Source-of-Truth Matrix

### Salesforce-Owned Fields (never write from Omni)

| Entity | Field | SF Field | Notes |
|---|---|---|---|
| Account | name | Account.Name | |
| Account | owner | Account.OwnerId / Owner.Name | |
| Account | csm | Account.CSM__c / CSM__r.Name | Custom field |
| Account | status | Account.Status__c | Custom field |
| Account | industry | Account.Industry | |
| Account | billing address | Account.BillingStreet etc. | |
| Account | annual_revenue | Account.AnnualRevenue | |
| Contact | all fields | Contact.* | |
| Opportunity | stage | Opportunity.StageName | |
| Opportunity | amount | Opportunity.Amount | |
| Opportunity | close_date | Opportunity.CloseDate | |
| Opportunity | owner | Opportunity.OwnerId | |

### Stripe-Owned Fields (never write from Omni)

| Entity | Field | Stripe Field | Notes |
|---|---|---|---|
| Customer | balance | customer.balance | |
| Customer | delinquent | customer.delinquent | |
| Customer | default_payment_method | customer.default_payment_method | |
| Subscription | status | subscription.status | |
| Subscription | current_period_* | subscription.current_period_start/end | |
| Subscription | cancel_at* | subscription.cancel_at* | |
| Subscription | trial_* | subscription.trial_start/end | |
| Invoice | status | invoice.status | |
| Invoice | amount_* | invoice.amount_due/paid/remaining | |
| Invoice | paid_at | invoice.status_transitions.paid_at | |
| Product | active | product.active | |
| Price | unit_amount | price.unit_amount | |
| Price | recurring.* | price.recurring.* | |

### Omni-Owned Fields (Omni is authoritative)

| Entity | Field | Notes |
|---|---|---|
| QuoteRecord | all fields | Omni workflow state |
| AuditLog | all fields | Omni audit trail |
| sync_jobs | all fields | Omni operational state |
| sync_events | all fields | Omni audit log |

### Cross-System Link Fields (Omni manages the mapping)

| Field | Written By | Notes |
|---|---|---|
| sf_accounts.stripe_customer_id | Omni sync (from Stripe metadata or SF custom field) | |
| stripe_customers.sf_account_id | Omni sync (from Stripe metadata or SF custom field) | |
| stripe_products.sf_product_id | Omni sync (from Stripe metadata) | |
| CustomerIndex.sfAccountId / stripeCustomerId | Omni (existing) | Keep as-is for now |

### Fields Omni Writes TO Source Systems

| Target | Field | When | Write-Through Policy |
|---|---|---|---|
| Stripe | customer.metadata.salesforce_account_id | When creating/linking a customer | Also update local `stripe_customers.sf_account_id` |
| Stripe | subscription (create) | Quote acceptance | `upsertStripeSubscription()` mirrors locally |
| Salesforce | Stripe_Quote__c (create/update) | Quote creation, status changes | Fire-and-forget with `.catch()` — not mirrored locally |
| Salesforce | Contract (create) | Quote acceptance | Fire-and-forget — not mirrored locally |
| Salesforce | Stripe_Quote_Event__c (create) | Various events | Fire-and-forget — not mirrored locally |

---

## Refinement 5: Write-Through Policy

When Omni writes to Salesforce or Stripe, the local mirror must stay consistent. Rules:

### Stripe writes → immediate local mirror update

When Omni creates/updates a Stripe object, **also upsert the local mirror in the same server action**. You already do this for subscriptions (`upsertStripeSubscription`). Extend this pattern to customers and invoices.

```
// Pattern for all Stripe writes:
const customer = await stripe.customers.create({ ... });
await upsertStripeCustomer(customer);  // mirror locally immediately
```

### Salesforce writes → do NOT mirror locally (yet)

Omni writes to SF are fire-and-forget timeline events and quote mirrors. These SF objects are not currently mirrored in Postgres, so there's nothing to update. When you add `sf_accounts` mirroring in Phase 1, the 15-min cron will pick up any changes Omni made to SF.

**Exception:** When Omni links a Stripe customer to an SF account (writes `metadata.salesforce_account_id` to Stripe), update both local mirror tables immediately:
```
await stripe.customers.update(cusId, { metadata: { salesforce_account_id: sfId } });
await prisma.stripeCustomer.update({ where: { id: cusId }, data: { sfAccountId: sfId } });
await prisma.sfAccount.update({ where: { id: sfId }, data: { stripeCustomerId: cusId } });
```

---

## v1 Schema — Exact Prisma Models

These models extend your existing `schema.prisma`. Add them after the existing `StripeSubscriptionItem` model.

```prisma
// ---------------------------------------------------------------------------
// Sync infrastructure
// ---------------------------------------------------------------------------

model SyncJob {
  id               String    @id @default(cuid())
  jobType          String    @map("job_type")
  status           String    @default("pending") // pending, running, completed, failed
  cursor           String?                       // last SystemModstamp, last Stripe ID, etc.
  recordsProcessed Int       @default(0) @map("records_processed")
  recordsCreated   Int       @default(0) @map("records_created")
  recordsUpdated   Int       @default(0) @map("records_updated")
  recordsErrored   Int       @default(0) @map("records_errored")
  error            String?
  startedAt        DateTime? @map("started_at")
  completedAt      DateTime? @map("completed_at")
  createdAt        DateTime  @default(now()) @map("created_at")

  @@index([jobType, status])
  @@index([createdAt])
  @@map("sync_jobs")
}

model SyncEvent {
  id          String    @id @default(cuid())
  source      String                          // 'stripe', 'salesforce', 'docusign'
  eventType   String    @map("event_type")    // 'customer.updated', 'account.sync', etc.
  externalId  String?   @map("external_id")   // stripe event ID, SF record ID
  objectType  String?   @map("object_type")   // 'customer', 'subscription', 'account'
  objectId    String?   @map("object_id")     // the entity this event is about
  action      String?                         // 'created', 'updated', 'deleted', 'synced'
  success     Boolean   @default(true)
  error       String?
  payload     Json?                           // raw payload (nullable to save space on success)
  createdAt   DateTime  @default(now()) @map("created_at")

  @@unique([source, externalId])
  @@index([source, eventType])
  @@index([objectType, objectId])
  @@index([createdAt])
  @@map("sync_events")
}

// ---------------------------------------------------------------------------
// Stripe mirrors (new)
// ---------------------------------------------------------------------------

model StripeCustomer {
  id                   String    @id // cus_xxx
  name                 String?
  email                String?
  phone                String?
  description          String?
  currency             String?
  balance              Int       @default(0)     // cents
  delinquent           Boolean   @default(false)
  defaultPaymentMethod String?   @map("default_payment_method")

  // Cross-system link
  sfAccountId          String?   @map("sf_account_id")

  metadata             Json?
  raw                  Json?     // full Stripe customer object

  stripeCreated        DateTime? @map("stripe_created")
  syncedAt             DateTime  @default(now()) @map("synced_at")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  @@index([email])
  @@index([sfAccountId])
  @@map("stripe_customers")
}

model StripeProduct {
  id             String   @id // prod_xxx
  name           String
  description    String?
  active         Boolean  @default(true)
  defaultPriceId String?  @map("default_price_id")

  // Cross-system link
  sfProductId    String?  @map("sf_product_id")

  metadata       Json?
  raw            Json?

  syncedAt       DateTime @default(now()) @map("synced_at")
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  prices StripePrice[]

  @@map("stripe_products")
}

model StripePrice {
  id                     String   @id // price_xxx
  productId              String   @map("product_id")
  active                 Boolean  @default(true)
  currency               String?
  unitAmount             Int?     @map("unit_amount") // cents
  billingScheme          String?  @map("billing_scheme") // per_unit, tiered
  recurringInterval      String?  @map("recurring_interval") // month, year, null
  recurringIntervalCount Int      @default(1) @map("recurring_interval_count")
  type                   String?  // one_time, recurring
  nickname               String?

  metadata               Json?
  raw                    Json?

  syncedAt               DateTime @default(now()) @map("synced_at")
  createdAt              DateTime @default(now()) @map("created_at")
  updatedAt              DateTime @updatedAt @map("updated_at")

  product StripeProduct @relation(fields: [productId], references: [id], onDelete: Cascade)

  @@index([productId])
  @@map("stripe_prices")
}

model StripeInvoice {
  id               String    @id // in_xxx
  customerId       String    @map("customer_id")
  subscriptionId   String?   @map("subscription_id")
  status           String?   // draft, open, paid, void, uncollectible
  collectionMethod String?   @map("collection_method")
  currency         String?
  amountDue        Int?      @map("amount_due")
  amountPaid       Int?      @map("amount_paid")
  amountRemaining  Int?      @map("amount_remaining")
  subtotal         Int?
  total            Int?
  tax              Int?
  dueDate          DateTime? @map("due_date")
  paidAt           DateTime? @map("paid_at")
  periodStart      DateTime? @map("period_start")
  periodEnd        DateTime? @map("period_end")
  hostedInvoiceUrl String?   @map("hosted_invoice_url")
  invoicePdf       String?   @map("invoice_pdf")
  number           String?   // INV-0001

  metadata         Json?
  raw              Json?

  stripeCreated    DateTime? @map("stripe_created")
  syncedAt         DateTime  @default(now()) @map("synced_at")
  createdAt        DateTime  @default(now()) @map("created_at")
  updatedAt        DateTime  @updatedAt @map("updated_at")

  @@index([customerId])
  @@index([subscriptionId])
  @@index([status])
  @@map("stripe_invoices")
}

// ---------------------------------------------------------------------------
// Salesforce mirrors
// ---------------------------------------------------------------------------

model SfAccount {
  id                   String    @id // SF Account.Id (18-char)
  name                 String
  domain               String?   // cleaned from Website
  ownerId              String?   @map("owner_id")
  ownerName            String?   @map("owner_name")
  csmId                String?   @map("csm_id")
  csmName              String?   @map("csm_name")
  accountType          String?   @map("account_type")
  status               String?
  industry             String?
  billingCity          String?   @map("billing_city")
  billingState         String?   @map("billing_state")
  billingCountry       String?   @map("billing_country")
  annualRevenue        Float?    @map("annual_revenue")
  dateOfFirstClosedWon DateTime? @map("date_of_first_closed_won")

  // Cross-system link
  stripeCustomerId     String?   @map("stripe_customer_id")

  raw                  Json?     // full SF Account payload

  sfLastModified       DateTime? @map("sf_last_modified") // SystemModstamp
  syncedAt             DateTime  @default(now()) @map("synced_at")
  createdAt            DateTime  @default(now()) @map("created_at")
  updatedAt            DateTime  @updatedAt @map("updated_at")

  contacts      SfContact[]
  opportunities SfOpportunity[]

  @@index([stripeCustomerId])
  @@index([ownerId])
  @@index([status])
  @@index([sfLastModified])
  @@map("sf_accounts")
}

model SfContact {
  id             String    @id // SF Contact.Id
  accountId      String?   @map("account_id")
  firstName      String?   @map("first_name")
  lastName       String?   @map("last_name")
  name           String
  email          String?
  phone          String?
  title          String?
  isPrimary      Boolean   @default(false) @map("is_primary")

  raw            Json?

  sfLastModified DateTime? @map("sf_last_modified")
  syncedAt       DateTime  @default(now()) @map("synced_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  account SfAccount? @relation(fields: [accountId], references: [id], onDelete: SetNull)

  @@index([accountId])
  @@index([email])
  @@map("sf_contacts")
}

model SfOpportunity {
  id             String    @id // SF Opportunity.Id
  accountId      String?   @map("account_id")
  name           String
  stageName      String    @map("stage_name")
  amount         Float?
  closeDate      DateTime? @map("close_date")
  ownerId        String?   @map("owner_id")
  ownerName      String?   @map("owner_name")
  type           String?
  isClosed       Boolean   @default(false) @map("is_closed")
  isWon          Boolean   @default(false) @map("is_won")

  raw            Json?

  sfCreatedDate  DateTime? @map("sf_created_date")
  sfLastModified DateTime? @map("sf_last_modified")
  syncedAt       DateTime  @default(now()) @map("synced_at")
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  account SfAccount? @relation(fields: [accountId], references: [id], onDelete: SetNull)

  @@index([accountId])
  @@index([stageName])
  @@index([closeDate])
  @@index([sfLastModified])
  @@map("sf_opportunities")
}
```

### What about `CustomerIndex`?

Keep it as-is for now. It serves as Omni's internal linking table and is referenced by `WorkItem`, `AuditLog`, and existing query code. In Phase 2, you'll migrate its role to `SfAccount` + `StripeCustomer` with their FK columns, then deprecate `CustomerIndex`. Don't touch it in Phase 1.

---

## v1 Implementation Plan

### Step 0: Schema Migration (Day 1)

1. Add the Prisma models above to `schema.prisma`
2. Run `pnpm db:migrate` to create the migration
3. Run `pnpm db:generate` to regenerate the Prisma client
4. Verify `pnpm build` passes

### Step 1: Stripe Customer Sync (Days 2-3)

**File:** `apps/console/src/lib/actions/stripe-customer-sync.ts` (already exists — extend it)

Create `upsertStripeCustomer()` following the exact same pattern as `upsertStripeSubscription()`:

```typescript
export async function upsertStripeCustomer(customer: Stripe.Customer) {
  const sfAccountId =
    customer.metadata?.salesforce_account_id ??
    customer.metadata?.sf_account_id ??
    null;

  await prisma.stripeCustomer.upsert({
    where: { id: customer.id },
    create: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      description: customer.description,
      currency: customer.currency,
      balance: customer.balance ?? 0,
      delinquent: customer.delinquent ?? false,
      defaultPaymentMethod:
        typeof customer.default_payment_method === 'string'
          ? customer.default_payment_method
          : customer.default_payment_method?.id ?? null,
      sfAccountId,
      metadata: customer.metadata ?? {},
      raw: customer as unknown as Prisma.JsonObject,
      stripeCreated: new Date(customer.created * 1000),
      syncedAt: new Date(),
    },
    update: {
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      description: customer.description,
      currency: customer.currency,
      balance: customer.balance ?? 0,
      delinquent: customer.delinquent ?? false,
      defaultPaymentMethod:
        typeof customer.default_payment_method === 'string'
          ? customer.default_payment_method
          : customer.default_payment_method?.id ?? null,
      sfAccountId,
      metadata: customer.metadata ?? {},
      raw: customer as unknown as Prisma.JsonObject,
      syncedAt: new Date(),
    },
  });
}
```

**Webhook handler** — add cases to `apps/console/src/app/api/stripe/webhook/route.ts`:

```typescript
case "customer.created":
case "customer.updated": {
  const customer = event.data.object as Stripe.Customer;
  await upsertStripeCustomer(customer);
  break;
}
case "customer.deleted": {
  const deleted = event.data.object as Stripe.DeletedCustomer;
  await prisma.stripeCustomer.delete({ where: { id: deleted.id } }).catch(() => {});
  break;
}
```

### Step 2: Stripe Product/Price Sync (Days 3-4)

**File:** `apps/console/src/lib/actions/stripe-product-sync.ts` (new)

Create `upsertStripeProduct()` and `upsertStripePrice()` following the same pattern.

**Webhook handlers** — add to existing route:

```typescript
case "product.created":
case "product.updated": {
  // Keep existing ProductLog behavior, then also mirror:
  await upsertStripeProduct(event.data.object as Stripe.Product);
  break;
}
case "price.created":
case "price.updated": {
  await upsertStripePrice(event.data.object as Stripe.Price);
  break;
}
```

### Step 3: Stripe Invoice Sync (Day 4)

**File:** `apps/console/src/lib/actions/stripe-invoice-sync.ts` (new)

**Webhook handlers:**

```typescript
case "invoice.created":
case "invoice.updated":
case "invoice.paid":
case "invoice.payment_failed":
case "invoice.voided": {
  await upsertStripeInvoice(event.data.object as Stripe.Invoice);
  break;
}
```

### Step 4: Backfill Scripts (Day 5)

**File:** `scripts/backfill-stripe-customers.ts`

```typescript
// Iterate all Stripe customers, upsert each into stripe_customers table
const stripe = getStripeClient();
for await (const customer of stripe.customers.list({ limit: 100 })) {
  await upsertStripeCustomer(customer);
  count++;
}
```

**File:** `scripts/backfill-stripe-products.ts`

Same pattern — iterate `stripe.products.list()` and `stripe.prices.list()`.

**File:** `scripts/backfill-stripe-invoices.ts`

Iterate `stripe.invoices.list({ limit: 100, created: { gte: sixMonthsAgo } })`.

Run all three with `npx tsx scripts/backfill-stripe-customers.ts`.

### Step 5: SF Account Sync Cron (Days 6-8)

**File:** `apps/console/src/app/api/cron/sync-sf-accounts/route.ts`

```typescript
import { NextResponse } from "next/server";
import { prisma } from "@omnibridge/db";

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check for already-running job
  const running = await prisma.syncJob.findFirst({
    where: { jobType: "sf_accounts_incremental", status: "running" },
  });
  if (running) {
    return NextResponse.json({ skipped: "already_running" });
  }

  // Get cursor from last successful job
  const lastJob = await prisma.syncJob.findFirst({
    where: { jobType: "sf_accounts_incremental", status: "completed" },
    orderBy: { completedAt: "desc" },
  });
  const cursor = lastJob?.cursor ?? "2020-01-01T00:00:00.000Z";

  // Create job record
  const job = await prisma.syncJob.create({
    data: {
      jobType: "sf_accounts_incremental",
      status: "running",
      cursor,
      startedAt: new Date(),
    },
  });

  try {
    const { soql, escapeSoql } = await import("@omnibridge/salesforce");

    const records = await soql<SfAccountRow>(`
      SELECT Id, Name, Website, Industry, Type, Status__c,
             OwnerId, Owner.Name, CSM__c, CSM__r.Name,
             BillingCity, BillingState, BillingCountry,
             AnnualRevenue, Date_of_First_Closed_Won__c,
             Stripe_Customer_ID__c, SystemModstamp
      FROM Account
      WHERE SystemModstamp > ${escapeSoql(cursor)}
      ORDER BY SystemModstamp ASC
      LIMIT 200
    `);

    let created = 0, updated = 0, errored = 0;
    let newCursor = cursor;

    for (const record of records) {
      try {
        const existing = await prisma.sfAccount.findUnique({ where: { id: record.Id } });
        await prisma.sfAccount.upsert({
          where: { id: record.Id },
          create: mapSfAccountToRow(record),
          update: mapSfAccountToRow(record),
        });
        if (existing) updated++; else created++;
        newCursor = record.SystemModstamp;
      } catch (err) {
        errored++;
        console.error(`[sync-sf-accounts] Error on ${record.Id}:`, err);
      }
    }

    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        cursor: newCursor,
        recordsProcessed: records.length,
        recordsCreated: created,
        recordsUpdated: updated,
        recordsErrored: errored,
        completedAt: new Date(),
      },
    });

    return NextResponse.json({ processed: records.length, created, updated, errored });
  } catch (err) {
    await prisma.syncJob.update({
      where: { id: job.id },
      data: {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        completedAt: new Date(),
      },
    });
    return NextResponse.json({ error: "Sync failed" }, { status: 500 });
  }
}
```

**Important:** The SF SOQL field names above are examples. You'll need to check your actual SF org's custom field API names using `sf sobject describe Account --target-org production`.

### Step 6: SF Opportunities + Contacts Sync (Days 8-9)

Same cron pattern as accounts:
- `apps/console/src/app/api/cron/sync-sf-opportunities/route.ts`
- `apps/console/src/app/api/cron/sync-sf-contacts/route.ts`

Contacts sync can scope to recently-modified accounts to keep volume manageable:
```sql
SELECT Id, ... FROM Contact
WHERE Account.SystemModstamp > :cursor
ORDER BY SystemModstamp ASC LIMIT 200
```

### Step 7: SF Backfill Script (Day 9)

**File:** `scripts/backfill-sf-accounts.ts`

Same as the cron but without the 200-record limit — loops until all accounts are fetched, using `SystemModstamp` cursor pagination.

### Step 8: Auto-Link SF ↔ Stripe (Day 10)

**File:** `scripts/link-sf-stripe.ts`

```typescript
// For each stripe_customer with metadata.salesforce_account_id:
//   1. Set stripe_customers.sf_account_id
//   2. Set sf_accounts.stripe_customer_id (if the sf_account exists)
//
// For each sf_account with Stripe_Customer_ID__c:
//   1. Set sf_accounts.stripe_customer_id
//   2. Set stripe_customers.sf_account_id (if the stripe_customer exists)
```

This is a one-time script that runs after both backfills complete. Future links are maintained by the sync jobs.

### Step 9: Vercel Cron Configuration (Day 10)

**File:** `vercel.json` (create or extend)

```json
{
  "crons": [
    {
      "path": "/api/cron/sync-sf-accounts",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/sync-sf-opportunities",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/sync-sf-contacts",
      "schedule": "0 */2 * * *"
    }
  ]
}
```

Add `CRON_SECRET` to your Vercel environment variables.

### Step 10: Admin Sync Status Page (Day 11)

**File:** `apps/console/src/app/(app)/admin/sync/page.tsx`

Server component that queries `sync_jobs`:

```typescript
const recentJobs = await prisma.syncJob.findMany({
  orderBy: { createdAt: "desc" },
  take: 50,
});
```

Display as a simple Card + Table showing: job type, status, records processed, duration, errors, last cursor. Admin-only route.

### Step 11: Migrate First UI Surface — Products (Days 12-13)

**File:** `apps/console/src/lib/queries/stripe-products.ts`

Add a new function that reads from the local mirror:

```typescript
export async function fetchStripeProductsFromDb(): Promise<StripeProduct[]> {
  const products = await prisma.stripeProduct.findMany({
    where: { active: true },
    include: { prices: { where: { active: true } } },
    orderBy: { name: "asc" },
  });
  return products.map(mapDbProductToStripeProduct);
}
```

**In the products page**, add a feature flag to switch between live API and DB:

```typescript
const products = flags.useDbProducts
  ? await fetchStripeProductsFromDb()
  : await fetchStripeProducts();
```

Run both paths for a week, comparing results. Then remove the live API path.

### Step 12: Migrate Customers List (Days 14-16)

Replace `getMyAccounts()` (which calls SF SOQL live) with:

```typescript
export async function getMyAccountsFromDb(ownerEmail: string): Promise<MyAccount[]> {
  // Look up SF user by email to get owner_id
  // Then query sf_accounts + join stripe_customers for billing data
  const accounts = await prisma.sfAccount.findMany({
    where: { ownerName: { contains: ownerEmail.split("@")[0], mode: "insensitive" } },
    orderBy: { name: "asc" },
  });
  // ... map to MyAccount shape
}
```

### Step 13: Migrate Opportunities Dashboard (Days 17-18)

Replace `getDashboardOpportunities()` with:

```typescript
export async function getDashboardOpportunitiesFromDb(): Promise<OpportunityRow[]> {
  const opps = await prisma.sfOpportunity.findMany({
    where: {
      sfCreatedDate: { gte: new Date(`${new Date().getFullYear()}-01-01`) },
    },
    orderBy: { closeDate: "asc" },
  });
  return opps.map(mapToOpportunityRow);
}
```

---

## First Admin/Debug Tools

### 1. Sync Status Dashboard (`/admin/sync`)
- Table of recent `sync_jobs` with status badges
- "Run Now" buttons that trigger each cron endpoint manually
- Last sync timestamp per job type

### 2. Unlinked Records View (`/admin/unlinked`)
- Stripe customers with no `sf_account_id` → candidates for manual linking
- SF accounts with no `stripe_customer_id` → candidates for manual linking
- Simple "Link" button that writes both FK columns

### 3. Record Inspector (`/admin/inspect/[type]/[id]`)
- Shows the local mirror row + raw JSON payload
- "Re-fetch from source" button that calls the API and upserts
- Shows `synced_at` timestamp and staleness

---

## File Inventory for v1

### New files to create:

```
packages/db/prisma/schema.prisma                          (extend)
apps/console/src/lib/actions/stripe-customer-sync.ts      (extend existing)
apps/console/src/lib/actions/stripe-product-sync.ts       (new)
apps/console/src/lib/actions/stripe-invoice-sync.ts       (new)
apps/console/src/app/api/stripe/webhook/route.ts          (extend)
apps/console/src/app/api/cron/sync-sf-accounts/route.ts   (new)
apps/console/src/app/api/cron/sync-sf-opportunities/route.ts (new)
apps/console/src/app/api/cron/sync-sf-contacts/route.ts   (new)
scripts/backfill-stripe-customers.ts                      (new)
scripts/backfill-stripe-products.ts                       (new)
scripts/backfill-stripe-invoices.ts                       (new)
scripts/backfill-sf-accounts.ts                           (new)
scripts/link-sf-stripe.ts                                 (new)
apps/console/src/app/(app)/admin/sync/page.tsx            (new)
vercel.json                                               (new or extend)
```

### Files to modify later (Phase 1 UI migration):

```
apps/console/src/lib/queries/stripe-products.ts           (add DB read path)
apps/console/src/lib/queries/customers.ts                 (add DB read path)
apps/console/src/lib/queries/opportunities.ts             (add DB read path)
apps/console/src/lib/feature-flags.ts                     (add useDbProducts etc.)
```

---

## Build Order Summary

| Day | What | Risk |
|---|---|---|
| 1 | Schema migration (add all Prisma models) | Low — additive only |
| 2-3 | `upsertStripeCustomer` + webhook handlers | Low — follows existing pattern |
| 3-4 | `upsertStripeProduct/Price` + webhook handlers | Low |
| 4 | `upsertStripeInvoice` + webhook handlers | Low |
| 5 | Backfill scripts (Stripe customers, products, invoices) | Medium — test on staging first |
| 6-8 | SF accounts cron sync | Medium — SOQL field names need verification |
| 8-9 | SF opportunities + contacts cron sync | Low — same pattern |
| 9 | SF backfill script | Medium — large volume, may need chunking |
| 10 | Auto-link script + Vercel cron config | Low |
| 11 | Admin sync status page | Low |
| 12-13 | Migrate products page to DB reads | Low — feature-flagged |
| 14-16 | Migrate customers list to DB reads | Medium — more complex query |
| 17-18 | Migrate opportunities dashboard to DB reads | Low |

---

## What NOT to Build in v1

- `entity_link` table (use FK columns instead)
- Materialized views (regular views are fast enough)
- Stripe charge/payment_intent mirroring (invoices are sufficient)
- MRR historical snapshots / trending
- Drift detection dashboard (query manually)
- External queue system (Inngest/QStash)
- Full-text search with pg_trgm (Prisma `contains` is sufficient for now)
- SF Account → Stripe Customer auto-creation
- Webhook retry queue (Stripe handles retries)
- Real-time sync (15-min cron is fine for SF)
