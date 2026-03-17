# Omni Read-Model Architecture

## 1. Executive Recommendation

**Use your existing Postgres database (via Prisma) as a unified read model.** Don't add a new database — extend the one you have.

The architecture is simple: Salesforce and Stripe remain the systems of record for their domains. Omni's Postgres becomes the **fast query layer** that mirrors source data, links entities across systems, and serves the UI. Every screen reads from Postgres. External APIs are only called for writes and periodic reconciliation.

**Why Postgres (not Elasticsearch, Redis, or a data warehouse):**
- You already have it via Prisma/Supabase/Neon
- It handles joins, full-text search, jsonb, and materialized views natively
- Prisma gives you migrations, type safety, and a query builder
- No operational overhead of a second data store
- Postgres on Neon/Supabase scales well beyond what Omni needs for years

**What Omni should own:**
- The entity linking graph (SF Account ↔ Stripe Customer)
- Workflow state (quote lifecycle, sync status, audit trail)
- Derived rollups (MRR, account health, renewal forecasts)
- Internal metadata (feature flags, user preferences, job state)

**What Omni should NOT own:**
- Canonical customer/account data (Salesforce owns)
- Billing state, subscription lifecycle, invoice data (Stripe owns)
- Contract terms, pricing (Stripe owns, SF mirrors for CRM context)

**How Vercel changes the design:**
- No long-running workers — all sync must be webhook-driven or cron-triggered
- Serverless functions have 10s (hobby) or 60s (pro) timeouts — sync jobs must be chunked
- No in-memory state between requests — all state lives in Postgres
- Vercel Cron Jobs (cron.json) give you scheduled syncs up to once per minute
- You don't need an external queue system yet — Postgres itself can serve as a simple job queue

---

## 2. Systems of Record and Ownership Map

| Domain | System of Record | Omni's Role |
|---|---|---|
| Accounts / Companies | **Salesforce** | Mirror, index, search |
| Contacts | **Salesforce** | Mirror for quote workflows |
| Opportunities | **Salesforce** | Mirror for dashboards |
| Quotes (CRM context) | **Salesforce** | Mirror of SF Quote objects |
| Quote workflow state | **Omni (Postgres)** | Owns lifecycle, acceptance, audit |
| Quote line items | **Stripe** (pricing truth) / **Omni** (workflow) | Owns the bridge |
| Billing customer | **Stripe** | Mirror, link to SF Account |
| Subscriptions | **Stripe** | Mirror for dashboards, renewal forecasts |
| Invoices | **Stripe** | Mirror for payment history, AR views |
| Payments / Charges | **Stripe** | Mirror selectively (invoice-level, not charge-level) |
| Products / Prices | **Stripe** (billing truth) / **Salesforce** (catalog metadata) | Mirror both, link |
| Internal workflow metadata | **Omni (Postgres)** | Owns entirely |
| Health / risk rollups | **Omni (Postgres)** | Derived from mirrored data |
| Sync status / audit / repair | **Omni (Postgres)** | Owns entirely |

**Fields that should never be dual-written casually:**
- `subscription.status` — only Stripe sets this
- `account.owner` / `account.csm` — only Salesforce sets this
- `invoice.amount_due` / `invoice.paid` — only Stripe sets this
- `opportunity.stage` / `opportunity.amount` — only Salesforce sets this

**Where conflicts are likely:**
- Customer name (SF Account.Name vs Stripe customer.name) — SF wins, Stripe is convenience
- Product names (SF Product2.Name vs Stripe product.name) — use SF for display, Stripe for billing
- Contact email (SF Contact.Email vs Stripe customer.email) — SF wins for CRM, Stripe for billing

**What Omni should derive, not own:**
- MRR (computed from subscription items)
- ARR (MRR × 12)
- Account health score (computed from sub status, payment history, renewal proximity)
- Renewal calendar (computed from subscription period end + cancel_at)
- Quote totals (computed from line items at query time)

---

## 3. Read-Model Architecture

### Layer 1: Raw Source Payloads

**Purpose:** Durable record of exactly what each source system told us. Never transformed, never mutated after write. The forensic layer.

**What belongs here:**
- Stripe webhook event payloads
- Salesforce sync batch payloads
- DocuSign envelope payloads

**Why it matters:** When a derived view looks wrong, you can always replay from raw payloads. When Stripe or Salesforce changes their schema, you can re-derive without re-fetching. This is your insurance policy.

### Layer 2: Normalized Core Tables

**Purpose:** Clean, typed, indexed representations of source entities. One row per entity. Updated via upsert from sync processes. This is where 90% of queries read from.

**What belongs here:**
- `sf_accounts` — mirrors Salesforce Account fields you care about
- `sf_contacts` — mirrors Salesforce Contact
- `sf_opportunities` — mirrors Salesforce Opportunity
- `stripe_customers` — mirrors Stripe Customer
- `stripe_subscriptions` — mirrors Stripe Subscription (you already have this)
- `stripe_subscription_items` — mirrors Stripe SubscriptionItem (you already have this)
- `stripe_invoices` — mirrors Stripe Invoice
- `stripe_products` / `stripe_prices` — mirrors Stripe catalog
- `entity_links` — cross-system identity mappings

**Why it matters:** Queries hit indexed Postgres columns instead of parsing JSON or calling APIs. Prisma gives you typed access. Joins are fast.

### Layer 3: Derived / Serving Layer

**Purpose:** Pre-computed aggregations and joined views that serve specific UI surfaces. Rebuilt periodically or on-demand.

**What belongs here:**
- `v_customer_360` — joined account + billing + subscription summary
- `v_renewal_forecast` — upcoming renewals with MRR at risk
- `v_account_health` — composite health score per account
- `v_mrr_by_customer` — current MRR breakdown
- `v_quote_summary` — quote with all context joined

**Why it matters:** Dashboard queries become single-table reads. No N+1, no cross-system joins, no API latency.

---

## 4. Initial Postgres Schema Proposal

### Priority 1 — Build First

```sql
-- ============================================================
-- RAW EVENT LOG (already partially exists as ProductLog/AuditLog)
-- ============================================================

CREATE TABLE sync_events (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  source          TEXT NOT NULL,          -- 'stripe', 'salesforce', 'docusign'
  event_type      TEXT NOT NULL,          -- 'customer.updated', 'account.sync', etc.
  external_id     TEXT,                   -- stripe event ID, SF record ID
  object_type     TEXT,                   -- 'customer', 'subscription', 'account'
  object_id       TEXT,                   -- the entity this event is about
  payload         JSONB NOT NULL,         -- raw payload
  processed_at    TIMESTAMPTZ,
  error           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Dedupe: same external event should not be processed twice
  CONSTRAINT uq_sync_events_external UNIQUE (source, external_id)
);

CREATE INDEX idx_sync_events_source_type ON sync_events (source, event_type);
CREATE INDEX idx_sync_events_object ON sync_events (object_type, object_id);
CREATE INDEX idx_sync_events_created ON sync_events (created_at);
CREATE INDEX idx_sync_events_unprocessed ON sync_events (processed_at)
  WHERE processed_at IS NULL;


-- ============================================================
-- SALESFORCE MIRRORS
-- ============================================================

CREATE TABLE sf_accounts (
  id                    TEXT PRIMARY KEY,   -- SF Account.Id (18-char)
  name                  TEXT NOT NULL,
  domain                TEXT,               -- Website domain, cleaned
  owner_id              TEXT,
  owner_name            TEXT,
  csm_id                TEXT,
  csm_name              TEXT,
  account_type          TEXT,               -- 'Customer', 'Prospect', etc.
  status                TEXT,               -- custom status field
  industry              TEXT,
  billing_street        TEXT,
  billing_city          TEXT,
  billing_state         TEXT,
  billing_country       TEXT,
  annual_revenue        NUMERIC,
  date_of_first_closed_won DATE,

  -- Stripe linkage (denormalized for fast joins)
  stripe_customer_id    TEXT,

  raw                   JSONB,              -- full SF payload for fields we don't model

  sf_last_modified      TIMESTAMPTZ,        -- Account.SystemModstamp
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sf_accounts_stripe ON sf_accounts (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_sf_accounts_name_trgm ON sf_accounts
  USING gin (name gin_trgm_ops);
CREATE INDEX idx_sf_accounts_owner ON sf_accounts (owner_id);
CREATE INDEX idx_sf_accounts_status ON sf_accounts (status);
CREATE INDEX idx_sf_accounts_modified ON sf_accounts (sf_last_modified);


CREATE TABLE sf_contacts (
  id                    TEXT PRIMARY KEY,   -- SF Contact.Id
  account_id            TEXT REFERENCES sf_accounts(id),
  first_name            TEXT,
  last_name             TEXT,
  name                  TEXT NOT NULL,       -- FirstName + LastName
  email                 TEXT,
  phone                 TEXT,
  title                 TEXT,
  is_primary            BOOLEAN DEFAULT false,

  raw                   JSONB,
  sf_last_modified      TIMESTAMPTZ,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sf_contacts_account ON sf_contacts (account_id);
CREATE INDEX idx_sf_contacts_email ON sf_contacts (email)
  WHERE email IS NOT NULL;


CREATE TABLE sf_opportunities (
  id                    TEXT PRIMARY KEY,   -- SF Opportunity.Id
  account_id            TEXT REFERENCES sf_accounts(id),
  name                  TEXT NOT NULL,
  stage_name            TEXT NOT NULL,
  amount                NUMERIC,
  close_date            DATE,
  owner_id              TEXT,
  owner_name            TEXT,
  type                  TEXT,               -- 'New Business', 'Renewal', etc.
  is_closed             BOOLEAN DEFAULT false,
  is_won                BOOLEAN DEFAULT false,

  raw                   JSONB,
  sf_last_modified      TIMESTAMPTZ,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sf_opps_account ON sf_opportunities (account_id);
CREATE INDEX idx_sf_opps_stage ON sf_opportunities (stage_name);
CREATE INDEX idx_sf_opps_close ON sf_opportunities (close_date);
CREATE INDEX idx_sf_opps_modified ON sf_opportunities (sf_last_modified);


-- ============================================================
-- STRIPE MIRRORS (extend what you already have)
-- ============================================================

CREATE TABLE stripe_customers (
  id                    TEXT PRIMARY KEY,   -- cus_xxx
  name                  TEXT,
  email                 TEXT,
  phone                 TEXT,
  description           TEXT,
  currency              TEXT,
  balance               INTEGER DEFAULT 0,  -- cents
  delinquent            BOOLEAN DEFAULT false,
  default_payment_method TEXT,

  -- SF linkage (denormalized for fast joins)
  sf_account_id         TEXT,

  metadata              JSONB,
  raw                   JSONB,

  stripe_created        TIMESTAMPTZ,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_customers_email ON stripe_customers (email)
  WHERE email IS NOT NULL;
CREATE INDEX idx_stripe_customers_sf ON stripe_customers (sf_account_id)
  WHERE sf_account_id IS NOT NULL;
CREATE INDEX idx_stripe_customers_name_trgm ON stripe_customers
  USING gin (name gin_trgm_ops);


-- stripe_subscriptions and stripe_subscription_items already exist
-- Add these indexes if missing:
CREATE INDEX idx_stripe_subs_customer ON stripe_subscriptions (stripe_customer_id);
CREATE INDEX idx_stripe_subs_status ON stripe_subscriptions (status);
CREATE INDEX idx_stripe_subs_period_end ON stripe_subscriptions (current_period_end);


CREATE TABLE stripe_invoices (
  id                    TEXT PRIMARY KEY,   -- in_xxx
  customer_id           TEXT NOT NULL,
  subscription_id       TEXT,
  status                TEXT,               -- draft, open, paid, void, uncollectible
  collection_method     TEXT,
  currency              TEXT,
  amount_due            INTEGER,            -- cents
  amount_paid           INTEGER,
  amount_remaining      INTEGER,
  subtotal              INTEGER,
  total                 INTEGER,
  tax                   INTEGER,
  due_date              TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  period_start          TIMESTAMPTZ,
  period_end            TIMESTAMPTZ,
  hosted_invoice_url    TEXT,
  invoice_pdf           TEXT,
  number                TEXT,               -- INV-0001 etc.

  metadata              JSONB,
  raw                   JSONB,

  stripe_created        TIMESTAMPTZ,
  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_invoices_customer ON stripe_invoices (customer_id);
CREATE INDEX idx_stripe_invoices_sub ON stripe_invoices (subscription_id)
  WHERE subscription_id IS NOT NULL;
CREATE INDEX idx_stripe_invoices_status ON stripe_invoices (status);
CREATE INDEX idx_stripe_invoices_due ON stripe_invoices (due_date)
  WHERE status = 'open';


CREATE TABLE stripe_products (
  id                    TEXT PRIMARY KEY,   -- prod_xxx
  name                  TEXT NOT NULL,
  description           TEXT,
  active                BOOLEAN DEFAULT true,
  default_price_id      TEXT,
  sf_product_id         TEXT,               -- metadata.salesforce_product_id

  metadata              JSONB,
  raw                   JSONB,

  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE stripe_prices (
  id                    TEXT PRIMARY KEY,   -- price_xxx
  product_id            TEXT REFERENCES stripe_products(id),
  active                BOOLEAN DEFAULT true,
  currency              TEXT,
  unit_amount           INTEGER,            -- cents
  billing_scheme        TEXT,               -- 'per_unit' or 'tiered'
  recurring_interval    TEXT,               -- 'month', 'year', null for one-time
  recurring_interval_count INTEGER DEFAULT 1,
  type                  TEXT,               -- 'one_time' or 'recurring'
  nickname              TEXT,

  metadata              JSONB,
  raw                   JSONB,

  synced_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_prices_product ON stripe_prices (product_id);


-- ============================================================
-- ENTITY LINKS
-- ============================================================

CREATE TABLE entity_links (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  sf_account_id         TEXT,
  stripe_customer_id    TEXT,
  sf_opportunity_id     TEXT,
  stripe_subscription_id TEXT,
  sf_product_id         TEXT,
  stripe_product_id     TEXT,

  link_type             TEXT NOT NULL,       -- 'account_customer', 'opp_subscription',
                                             -- 'product_product'
  confidence            TEXT DEFAULT 'high', -- 'high', 'medium', 'low', 'manual'
  link_source           TEXT NOT NULL,       -- 'metadata', 'email_match', 'manual',
                                             -- 'sync_created'

  verified_at           TIMESTAMPTZ,
  verified_by           TEXT,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_entity_links_sf_account ON entity_links (sf_account_id)
  WHERE sf_account_id IS NOT NULL;
CREATE INDEX idx_entity_links_stripe_cust ON entity_links (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;
CREATE INDEX idx_entity_links_type ON entity_links (link_type);
CREATE UNIQUE INDEX uq_entity_links_account_customer
  ON entity_links (sf_account_id, stripe_customer_id)
  WHERE link_type = 'account_customer';


-- ============================================================
-- SYNC JOB TRACKING
-- ============================================================

CREATE TABLE sync_jobs (
  id                    TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  job_type              TEXT NOT NULL,       -- 'sf_accounts_full', 'sf_accounts_incremental',
                                             -- 'stripe_customers_full', etc.
  status                TEXT NOT NULL DEFAULT 'pending',
                                             -- 'pending', 'running', 'completed', 'failed'
  cursor                TEXT,                -- last SystemModstamp, last Stripe object ID, etc.
  records_processed     INTEGER DEFAULT 0,
  records_created       INTEGER DEFAULT 0,
  records_updated       INTEGER DEFAULT 0,
  error                 TEXT,
  started_at            TIMESTAMPTZ,
  completed_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_sync_jobs_type_status ON sync_jobs (job_type, status);
CREATE INDEX idx_sync_jobs_created ON sync_jobs (created_at);
```

### Priority 2 — Build When Needed

- `sf_quote_objects` — mirror of SF Quote custom objects (when you need CRM quote context beyond what QuoteRecord stores)
- `stripe_charges` — only if you need charge-level detail beyond invoices
- `stripe_payment_methods` — only if you show payment method info in the UI
- `stripe_coupons` / `stripe_discounts` — mirror when coupon management moves off live API
- `reconciliation_reports` — structured drift detection results

### Priority 3 — Build Later

- `account_health_scores` — materialized health rollup table
- `mrr_snapshots` — daily MRR point-in-time captures for trending
- `notification_queue` — if you build internal alerting

---

## 5. Entity Linking Strategy

**Primary strategy: metadata-based linking with fallback matching.**

### How to link SF Account ↔ Stripe Customer

**Tier 1 — Explicit ID in metadata (high confidence):**
```
Stripe customer.metadata.salesforce_account_id = "001XXXXXXXXXXXX"
```
This is the gold standard. When Omni creates a Stripe customer (or syncs one), it should always write the SF Account ID into metadata. This link is authoritative.

**Tier 2 — Reverse lookup from SF custom field:**
```
SF Account.Stripe_Customer_ID__c = "cus_XXXXXXXXXXXX"
```
Same idea, opposite direction. If your SF admin has added this field, use it.

**Tier 3 — Email/domain matching (medium confidence):**
Match `stripe_customers.email` domain against `sf_accounts.domain`. Only use as a suggestion — require manual verification before treating as authoritative.

**Tier 4 — Name matching (low confidence):**
Never auto-link based on names alone. Surface as "suggested match" in the UI.

### Implementation

Use **both** direct foreign keys on the mirror tables AND the `entity_links` table:

- **Direct FK columns** (`sf_accounts.stripe_customer_id`, `stripe_customers.sf_account_id`): Used for fast joins in queries. Set only when confidence is high.
- **`entity_links` table**: Records the full linking history, including confidence, source, and verification. Supports 1:many (one SF account with multiple Stripe customers) and audit trail.

```
Query path for "get customer 360":
  sf_accounts
    JOIN stripe_customers ON sf_accounts.stripe_customer_id = stripe_customers.id

Query path for "find unlinked records":
  sf_accounts WHERE stripe_customer_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM entity_links WHERE ...)
```

### Handling edge cases

| Scenario | Handling |
|---|---|
| SF Account exists, no Stripe customer | Show in UI with "No billing account" badge. Don't auto-create. |
| Stripe customer exists, no SF account | Show in UI with "No CRM account" badge. Flag for review. |
| One SF Account → many Stripe customers | Supported via entity_links. Pick one as "primary" for FK column. |
| One Stripe customer → many SF accounts | Rare but possible (mergers). Use entity_links, flag for manual resolution. |
| IDs change (SF record merge) | entity_links table preserves old mappings. Sync job updates FK columns. |

---

## 6. Sync Strategy by Object Type

### Salesforce Accounts

| Aspect | Design |
|---|---|
| **Sync method** | Scheduled incremental sync (every 15 min) + manual full refresh |
| **Freshness** | 15 minutes typical, instant for accounts touched by Omni workflows |
| **Update cursor** | `SystemModstamp > last_sync_timestamp` via SOQL |
| **Query** | `SELECT Id, Name, ... FROM Account WHERE SystemModstamp > :cursor ORDER BY SystemModstamp LIMIT 200` |
| **Idempotency** | Upsert on `id`. SystemModstamp prevents stale overwrites. |
| **Failure modes** | SF API rate limits (track via sync_jobs), token expiry, SOQL timeout on large orgs |
| **Repair** | Weekly full sync (Saturday night). Manual "re-sync account" button in UI. |

### Salesforce Contacts

| Aspect | Design |
|---|---|
| **Sync method** | Piggybacked on account sync (fetch contacts for recently-modified accounts) + on-demand for quote workflows |
| **Freshness** | 15 minutes for contacts on active accounts |
| **Update cursor** | `SystemModstamp` on Contact, scoped to account IDs |
| **Idempotency** | Upsert on `id` |
| **Failure modes** | Large accounts with 1000+ contacts — paginate |
| **Repair** | Triggered by account full sync |

### Salesforce Opportunities

| Aspect | Design |
|---|---|
| **Sync method** | Scheduled incremental sync (every 15 min) |
| **Freshness** | 15 minutes |
| **Update cursor** | `SystemModstamp` |
| **Query** | `SELECT Id, Name, AccountId, StageName, Amount, CloseDate, ... FROM Opportunity WHERE SystemModstamp > :cursor ORDER BY SystemModstamp LIMIT 200` |
| **Idempotency** | Upsert on `id` |
| **Failure modes** | Large number of opportunities — use pagination (`LIMIT 200` + loop) |
| **Repair** | Weekly full sync |

### Stripe Customers

| Aspect | Design |
|---|---|
| **Sync method** | Webhook (`customer.created`, `customer.updated`, `customer.deleted`) + nightly full reconciliation |
| **Freshness** | Near-realtime via webhooks |
| **Idempotency** | Upsert on `id`. Compare `updated` timestamp to avoid stale webhook overwrites. |
| **Failure modes** | Missed webhooks (Stripe retries for 3 days), webhook endpoint down |
| **Repair** | Nightly `stripe.customers.list()` with auto_paging, compare against local records |

### Stripe Subscriptions

| Aspect | Design |
|---|---|
| **Sync method** | Webhook (`customer.subscription.*`) — you already have this |
| **Freshness** | Near-realtime |
| **Idempotency** | You already handle this with `StripeSubscription` upserts |
| **Repair** | Nightly reconciliation via `stripe.subscriptions.list()` |

### Stripe Invoices

| Aspect | Design |
|---|---|
| **Sync method** | Webhook (`invoice.created`, `invoice.updated`, `invoice.paid`, `invoice.payment_failed`, `invoice.voided`) |
| **Freshness** | Near-realtime |
| **Idempotency** | Upsert on `id`. |
| **Failure modes** | High volume during billing cycle runs — webhook processing must be fast |
| **Repair** | Monthly reconciliation: `stripe.invoices.list({ created: { gte: monthStart } })` |

### Stripe Products / Prices

| Aspect | Design |
|---|---|
| **Sync method** | Webhook (`product.*`, `price.*`) + daily full sync |
| **Freshness** | Products change rarely — daily is fine |
| **Idempotency** | Upsert on `id` |
| **Repair** | Daily full sync is itself the repair mechanism |

---

## 7. Vercel-Aware Runtime Design

### What runs as request-time reads
- All UI data fetching → Prisma queries against Postgres
- Search → Postgres trigram indexes
- Dashboards → Postgres views or direct queries

### What runs as webhook handlers
- **Stripe webhooks** (existing route, extended):
  - `customer.*` → upsert `stripe_customers` + log to `sync_events`
  - `customer.subscription.*` → upsert `stripe_subscriptions` (already done)
  - `invoice.*` → upsert `stripe_invoices`
  - `product.*` / `price.*` → upsert `stripe_products` / `stripe_prices`
- **DocuSign webhooks** (existing route): already handled

### What runs as scheduled jobs (Vercel Cron)

```jsonc
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/sync-sf-accounts",
      "schedule": "*/15 * * * *"        // every 15 min
    },
    {
      "path": "/api/cron/sync-sf-opportunities",
      "schedule": "*/15 * * * *"
    },
    {
      "path": "/api/cron/reconcile-stripe",
      "schedule": "0 3 * * *"           // daily 3am UTC
    },
    {
      "path": "/api/cron/refresh-derived-views",
      "schedule": "*/30 * * * *"        // every 30 min
    }
  ]
}
```

Each cron endpoint:
1. Checks `sync_jobs` for running jobs of same type (skip if one is already running)
2. Creates a `sync_jobs` row with `status: 'running'`
3. Fetches incremental changes using stored cursor
4. Upserts records in batches of 100
5. Updates `sync_jobs` with results
6. Must complete within **60 seconds** (Vercel Pro function timeout)

### What should NOT depend on long-running server memory
- Entity link resolution (must be query-time, not cached in process)
- MRR calculations (must be query-time or materialized in DB)
- Sync cursors (stored in `sync_jobs`, not in-memory)

### What should be durable in Postgres
- All sync state (cursors, last-run times, error counts)
- All webhook events (logged to `sync_events` before processing)
- All entity links (never in-memory only)
- Derived view refresh timestamps

### Do I need an external queue system?

**Not yet.** For v1:
- Webhook handlers write directly to Postgres (fast upserts)
- Cron jobs handle scheduled syncs
- `sync_events` table with `processed_at IS NULL` serves as a simple retry queue

**When to add a queue (Inngest, QStash, or similar):**
- When you need fan-out (one webhook triggers multiple downstream actions)
- When webhook processing exceeds 10s regularly
- When you need guaranteed exactly-once processing with retries
- Likely: Phase 3 or 4, not Phase 1

### Scaling risks staying fully inside Vercel

| Risk | Likelihood | Mitigation |
|---|---|---|
| Cron job exceeds 60s timeout | Medium (large SF orgs) | Chunk work: process 200 records per run, store cursor, next run picks up |
| Webhook burst during Stripe billing run | Medium | Keep handler fast (upsert only, no downstream calls). Defer heavy work to cron. |
| Cold start latency on cron functions | Low | Acceptable for background sync. Not user-facing. |
| Postgres connection limits (Neon/Supabase) | Low-Medium | Use connection pooling (PgBouncer, built into Neon/Supabase). Prisma `connection_limit=5` per function. |

---

## 8. Query Model for the UI

### Screens to migrate first (stop hitting live APIs)

**1. Customers list (`/customers`)**
Currently: Calls `getMyAccounts()` which hits SF SOQL live + Stripe API for customer details.
After: `SELECT * FROM sf_accounts WHERE owner_id = :userId ORDER BY name` — instant.

**2. Subscriptions dashboard (`/subscriptions`)**
Currently: Reads from `stripe_subscriptions` table (already migrated!) but some MRR queries are slow.
After: Add `v_mrr_by_customer` materialized view. Dashboard loads in <100ms.

**3. Opportunities dashboard (`/opportunities`)**
Currently: `getDashboardOpportunities()` calls SF SOQL live every page load.
After: `SELECT * FROM sf_opportunities WHERE created_at >= :yearStart` — instant.

**4. Customer detail (`/customers/[id]`)**
Currently: Parallel calls to SF + Stripe + Prisma.
After: Single joined query from `sf_accounts JOIN stripe_customers JOIN stripe_subscriptions`.

**5. Product catalog (`/products`)**
Currently: `fetchStripeProducts()` calls Stripe API live.
After: `SELECT * FROM stripe_products JOIN stripe_prices ON ...` — instant, with search.

### Query patterns by type

| Pattern | Source |
|---|---|
| List/table views with filtering | Normalized tables with WHERE + indexes |
| Dashboard KPIs (MRR, counts) | Derived views or aggregation queries |
| Search (customer lookup) | Trigram indexes on name/email columns |
| Detail pages | Joined queries across normalized tables |
| Dropdown/picker data (products, contacts) | Normalized tables with simple SELECT |
| Audit trail | `audit_log` + `sync_events` tables |

### What might still call source systems directly (for now)
- **Creating** a Stripe subscription (write path — always hits Stripe)
- **Creating** a Salesforce opportunity (write path — always hits SF)
- **Quote acceptance** (write path — Stripe + SF + DocuSign)
- **Stripe Checkout session creation** (must be realtime)
- **Contact picker in quote wizard** — can stay live-SF until contacts are synced

---

## 9. High-Value Derived Views

### 1. Customer 360 View

```sql
CREATE OR REPLACE VIEW v_customer_360 AS
SELECT
  sa.id AS sf_account_id,
  sa.name AS account_name,
  sa.owner_name,
  sa.csm_name,
  sa.status AS account_status,
  sa.date_of_first_closed_won,
  sc.id AS stripe_customer_id,
  sc.email AS billing_email,
  sc.delinquent,
  sc.balance AS stripe_balance,
  -- Subscription rollup
  COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'active') AS active_sub_count,
  COUNT(DISTINCT ss.id) FILTER (WHERE ss.status = 'past_due') AS past_due_sub_count,
  -- MRR
  COALESCE(SUM(
    CASE ssi.billing_interval
      WHEN 'year'  THEN ssi.unit_amount * ssi.quantity / 12.0
      WHEN 'month' THEN ssi.unit_amount * ssi.quantity
      WHEN 'week'  THEN ssi.unit_amount * ssi.quantity * 52.0 / 12.0
      ELSE 0
    END
  ) FILTER (WHERE ss.status IN ('active', 'past_due', 'trialing')), 0) AS mrr_cents,
  -- Nearest renewal
  MIN(ss.current_period_end) FILTER (WHERE ss.status = 'active') AS next_renewal_date,
  -- Invoice summary
  COUNT(DISTINCT si.id) FILTER (WHERE si.status = 'open') AS open_invoice_count,
  SUM(si.amount_remaining) FILTER (WHERE si.status = 'open') AS open_invoice_total
FROM sf_accounts sa
LEFT JOIN stripe_customers sc ON sa.stripe_customer_id = sc.id
LEFT JOIN stripe_subscriptions ss ON ss.stripe_customer_id = sc.id
LEFT JOIN stripe_subscription_items ssi ON ssi.subscription_id = ss.id
LEFT JOIN stripe_invoices si ON si.customer_id = sc.id
GROUP BY sa.id, sc.id;
```

**What it answers:** "Show me everything about this account in one query."
**Type:** SQL view (not materialized — data changes frequently, and joins are fast with indexes).

### 2. Renewal Forecast

```sql
CREATE MATERIALIZED VIEW v_renewal_forecast AS
SELECT
  ss.id AS subscription_id,
  ss.stripe_customer_id,
  sa.id AS sf_account_id,
  sa.name AS account_name,
  sa.owner_name,
  sa.csm_name,
  ss.status,
  ss.current_period_end AS renewal_date,
  ss.cancel_at,
  ss.cancel_at_period_end,
  -- MRR at risk
  COALESCE(SUM(
    CASE ssi.billing_interval
      WHEN 'year'  THEN ssi.unit_amount * ssi.quantity / 12.0
      WHEN 'month' THEN ssi.unit_amount * ssi.quantity
      ELSE 0
    END
  ), 0) / 100.0 AS mrr_dollars,
  -- Risk flags
  CASE
    WHEN ss.cancel_at IS NOT NULL THEN 'canceling'
    WHEN ss.cancel_at_period_end THEN 'cancel_at_period_end'
    WHEN ss.status = 'past_due' THEN 'past_due'
    ELSE 'active'
  END AS risk_status
FROM stripe_subscriptions ss
JOIN stripe_customers sc ON ss.stripe_customer_id = sc.id
LEFT JOIN sf_accounts sa ON sa.stripe_customer_id = sc.id
LEFT JOIN stripe_subscription_items ssi ON ssi.subscription_id = ss.id
WHERE ss.status IN ('active', 'past_due', 'trialing')
GROUP BY ss.id, sa.id, sc.id;

CREATE INDEX idx_renewal_forecast_date ON v_renewal_forecast (renewal_date);
CREATE INDEX idx_renewal_forecast_risk ON v_renewal_forecast (risk_status);
```

**What it answers:** "What's renewing in the next 30/60/90 days and what MRR is at risk?"
**Type:** Materialized view, refreshed every 30 min via cron.

### 3. Account Health Rollup

```sql
CREATE MATERIALIZED VIEW v_account_health AS
SELECT
  sa.id AS sf_account_id,
  sa.name,
  sa.owner_name,
  sa.csm_name,
  -- Health score inputs
  CASE
    WHEN EXISTS (SELECT 1 FROM stripe_subscriptions ss
                 WHERE ss.stripe_customer_id = sa.stripe_customer_id
                 AND ss.status = 'past_due') THEN 'at_risk'
    WHEN EXISTS (SELECT 1 FROM stripe_subscriptions ss
                 WHERE ss.stripe_customer_id = sa.stripe_customer_id
                 AND ss.cancel_at IS NOT NULL) THEN 'churning'
    WHEN sa.stripe_customer_id IS NULL THEN 'no_billing'
    WHEN NOT EXISTS (SELECT 1 FROM stripe_subscriptions ss
                     WHERE ss.stripe_customer_id = sa.stripe_customer_id
                     AND ss.status = 'active') THEN 'inactive'
    ELSE 'healthy'
  END AS health_status
FROM sf_accounts sa
WHERE sa.status IN ('Active', 'Active Customer');
```

**Type:** Materialized view, refreshed every 30 min.

### 4. Mismatch / Drift Report

```sql
CREATE OR REPLACE VIEW v_sync_drift AS
-- Stripe customers with no SF account link
SELECT 'stripe_customer_no_sf' AS drift_type,
       sc.id AS entity_id, sc.name AS entity_name,
       sc.synced_at AS last_sync
FROM stripe_customers sc
WHERE sc.sf_account_id IS NULL
UNION ALL
-- SF accounts with no Stripe customer link
SELECT 'sf_account_no_stripe', sa.id, sa.name, sa.synced_at
FROM sf_accounts sa
WHERE sa.stripe_customer_id IS NULL
  AND sa.status IN ('Active', 'Active Customer')
UNION ALL
-- Subscriptions with no matching SF account
SELECT 'sub_no_sf_account', ss.id, sc.name, ss.synced_at
FROM stripe_subscriptions ss
JOIN stripe_customers sc ON ss.stripe_customer_id = sc.id
WHERE sc.sf_account_id IS NULL
  AND ss.status = 'active';
```

**What it answers:** "Where is our data out of sync across systems?"
**Type:** SQL view (run on-demand for ops review).

### 5. Quote Summary (already partially exists as QuoteRecord)

Keep your existing `QuoteRecord` table as-is — it's workflow state that Omni owns. Layer a view on top for the joined context:

```sql
CREATE OR REPLACE VIEW v_quote_summary AS
SELECT
  qr.*,
  sa.name AS sf_account_name,
  sa.owner_name AS account_owner,
  sc.email AS billing_email,
  ss.status AS subscription_status,
  ss.current_period_end AS sub_renewal_date
FROM quote_records qr
LEFT JOIN sf_accounts sa ON sa.stripe_customer_id = qr.stripe_customer_id
LEFT JOIN stripe_customers sc ON sc.id = qr.stripe_customer_id
LEFT JOIN stripe_subscriptions ss ON ss.id = qr.stripe_subscription_id;
```

---

## 10. Indexing and Performance Strategy

### Principles
1. **Index every external ID column** — these are your join keys
2. **Index every status column** — these are your filter keys
3. **Index timestamps used in WHERE clauses** — not every timestamp, just those you filter on
4. **Add trigram indexes for search columns** — requires `pg_trgm` extension
5. **Use partial indexes** where possible — smaller, faster
6. **Don't index jsonb columns** unless you have specific query patterns against them

### Critical indexes (already in schema above)

```
-- External ID joins (fast cross-system lookups)
sf_accounts.stripe_customer_id
stripe_customers.sf_account_id
stripe_invoices.customer_id
stripe_invoices.subscription_id
stripe_prices.product_id
sf_contacts.account_id
sf_opportunities.account_id

-- Status filters (dashboard queries)
stripe_subscriptions.status
stripe_invoices.status
sf_opportunities.stage_name
sf_accounts.status

-- Time-range filters (dashboard date ranges, sync cursors)
sf_accounts.sf_last_modified
sf_opportunities.close_date
stripe_invoices.due_date (partial: WHERE status = 'open')
stripe_subscriptions.current_period_end
sync_events.created_at

-- Search (customer lookup, product search)
sf_accounts.name (gin_trgm_ops)
stripe_customers.name (gin_trgm_ops)
stripe_customers.email
sf_contacts.email
```

### jsonb strategy
- Store `raw` jsonb on every mirror table for replay/debugging
- Do **not** index `raw` columns
- Do **not** query `raw` columns in production reads — extract needed fields to typed columns during sync
- `metadata` jsonb on Stripe tables is OK to query occasionally with `->>` but don't build dashboards on it

### What NOT to index yet
- `sync_events.payload` (jsonb, query-by-content not needed)
- `audit_log` columns beyond what you already have
- Any column you only read by primary key

---

## 11. Migration Plan from Current Architecture

### Phase 0: Preparation (1-2 days)

- [ ] Enable `pg_trgm` extension on your Postgres database
- [ ] Add `vercel.json` with empty crons array
- [ ] Create `apps/console/src/app/api/cron/` directory
- [ ] Add `CRON_SECRET` env var for Vercel cron auth
- [ ] Add sync_jobs and sync_events tables via migration
- [ ] Verify Postgres connection pooling config (important for serverless)

### Phase 1: First Mirror Tables (3-5 days)

Build in this order:
1. `stripe_customers` table + webhook handler for `customer.*` events
2. `stripe_products` + `stripe_prices` tables + daily sync cron
3. `sf_accounts` table + 15-min incremental sync cron
4. `entity_links` table + initial linking logic (metadata-based)

**Key principle:** Write the sync code but don't change any UI reads yet. Both paths run in parallel. New data flows into Postgres silently.

### Phase 2: First Syncs Running (3-5 days)

1. Add `sf_opportunities` table + 15-min sync
2. Add `sf_contacts` table (piggybacked on account sync)
3. Add `stripe_invoices` table + webhook handlers
4. Run a one-time full sync for each object type (backfill script)
5. Build a simple `/admin/sync-status` page showing `sync_jobs` state

### Phase 3: First DB-Backed Screens (5-7 days)

Migrate reads one screen at a time:

1. **Products page** — replace `fetchStripeProducts()` API call with Postgres query. Easiest win, lowest risk.
2. **Customers list** — replace `getMyAccounts()` SF SOQL with `sf_accounts` query. Search uses trigram index.
3. **Opportunities dashboard** — replace `getDashboardOpportunities()` with `sf_opportunities` query.
4. **Customer detail** — replace parallel API calls with single joined query from mirror tables.
5. **Subscriptions dashboard** — already reads from Postgres, but switch product lookups to `stripe_products` table.

**For each migration:**
- Keep the old code path behind a feature flag
- Log any discrepancies between old and new results (first week)
- Remove old code path after 1 week of clean operation

### Phase 4: Reconciliation and Hardening (ongoing)

1. Add nightly Stripe reconciliation cron (compare API list vs local table)
2. Add weekly SF full sync (catch anything incremental sync missed)
3. Build `v_sync_drift` view + admin page showing unlinked/mismatched records
4. Add monitoring: alert if `sync_jobs` has failed status for >1 hour
5. Build "re-sync" buttons on detail pages for manual repair

### What can remain live API for a while
- **Write operations** (creating quotes, subscriptions, SF records) — always hit source APIs
- **Quote acceptance flow** — always hits Stripe + SF live
- **Contact picker in quote wizard** — low volume, can stay live until Phase 3+
- **Coupon management** — low volume, low priority to migrate

### What should move first
- **Customer list / search** — highest traffic, most painful latency today
- **Products catalog** — simplest migration, good confidence builder
- **Opportunity dashboard** — eliminates expensive SOQL on every page load

---

## 12. Risks and Tradeoffs

### Data Drift
**Why it matters:** Mirror tables can fall behind source systems. User sees stale data.
**Likelihood:** Medium — webhooks can be missed, crons can fail.
**Mitigation:**
- Nightly reconciliation jobs compare local vs source
- `synced_at` timestamp on every row — UI can show "last synced" indicator
- "Refresh" button on detail pages triggers live re-fetch + upsert
- `sync_jobs` monitoring alerts on failures

### Stale Reads
**Why it matters:** User edits in Salesforce, reloads Omni, sees old data.
**Likelihood:** High for SF data (15-min sync delay). Low for Stripe (webhooks are fast).
**Mitigation:**
- Accept 15-min staleness for SF data — this is an internal ops tool, not a trading platform
- Show "last synced X min ago" in the UI where it matters
- Provide manual refresh buttons
- Write-through pattern: when Omni creates/updates SF records, also update local mirror immediately

### Duplicate Entity Links
**Why it matters:** One SF account linked to wrong Stripe customer → wrong MRR shown.
**Likelihood:** Medium — especially during initial backfill.
**Mitigation:**
- Unique constraint on `(sf_account_id, stripe_customer_id)` per link type
- Confidence levels on links — only auto-link on metadata match
- Admin UI to review and correct links
- Never auto-link based on name alone

### Source-of-Truth Confusion
**Why it matters:** Developer accidentally updates `sf_accounts.name` directly instead of syncing from SF.
**Likelihood:** Low-Medium.
**Mitigation:**
- Convention: mirror tables are read-only from the app's perspective. Writes go through sync processes only.
- Prisma model annotations / comments marking tables as "mirror — do not write directly"
- `synced_at` and `sf_last_modified` columns make it obvious when data came from sync vs was manually touched

### Webhook Gaps
**Why it matters:** Stripe retries for 3 days, but if your endpoint is down for 3+ days, events are lost.
**Likelihood:** Very low (Vercel uptime is excellent).
**Mitigation:**
- Nightly reconciliation catches anything webhooks missed
- `sync_events` table provides audit trail of what was received
- Stripe Dashboard shows failed webhook delivery attempts

### Salesforce / Stripe Schema Evolution
**Why it matters:** Stripe adds fields, deprecates endpoints. SF admin adds/renames fields.
**Likelihood:** Medium (happens a few times per year).
**Mitigation:**
- Store `raw` jsonb on every mirror row — new fields are captured even before you model them
- Sync code explicitly maps fields — no blind `INSERT *`
- Version your sync functions — when API changes, update the mapping

### Vercel Runtime Limitations
**Why it matters:** 60s function timeout, no persistent connections, cold starts.
**Likelihood:** Low for most workloads, Medium for large initial syncs.
**Mitigation:**
- Chunk sync jobs (200 records per invocation, cursor-based)
- Use connection pooling (PgBouncer / Neon proxy)
- Keep webhook handlers fast — upsert only, defer heavy work
- If you outgrow Vercel crons, move to Inngest (drops in with zero infra)

### Operational Complexity
**Why it matters:** More tables, more sync jobs, more things to monitor.
**Likelihood:** Certainty — this is the tradeoff.
**Mitigation:**
- Build the `/admin/sync-status` page early — visibility reduces anxiety
- Start with 3-4 tables, not 15
- Each sync job is a simple, testable function
- `sync_jobs` table gives you history and debugging without external monitoring

### Cost
**Why it matters:** More Postgres storage, more Vercel function invocations.
**Likelihood:** Low concern at Omni's scale.
**Mitigation:**
- Postgres storage is cheap ($0.25/GB on Neon)
- Cron jobs running every 15 min = ~3000 invocations/month (well within free tier)
- `raw` jsonb can be pruned after 90 days if storage becomes an issue (it won't)

---

## 13. Recommended First Build

### First 5 Tables
1. **`sync_jobs`** — track all sync operations from day one
2. **`sync_events`** — log webhook events before processing
3. **`stripe_customers`** — foundation for entity linking
4. **`sf_accounts`** — foundation for customer 360
5. **`stripe_products` + `stripe_prices`** — simplest full migration target

### First Webhook Handlers (extend existing Stripe webhook route)
1. `customer.created` / `customer.updated` → upsert `stripe_customers`
2. `product.created` / `product.updated` → upsert `stripe_products`
3. `price.created` / `price.updated` → upsert `stripe_prices`

### First Scheduled Syncs
1. `/api/cron/sync-sf-accounts` — incremental every 15 min
2. `/api/cron/sync-stripe-products` — full sync daily
3. `/api/cron/reconcile-stripe-customers` — nightly comparison

### First 3 UI Screens to Migrate
1. **Product catalog** (`/products`) — replace live Stripe API calls with DB reads
2. **Customers list** (`/customers`) — replace live SF SOQL with DB reads
3. **Opportunities dashboard** (`/opportunities`) — replace live SF SOQL with DB reads

### First Audit/Repair Tooling
1. `/admin/sync-status` page — show `sync_jobs` table with status, last run, error count
2. "Re-sync" button on customer detail page — triggers live fetch + upsert for one account
3. `v_sync_drift` view — query to find unlinked records (expose in admin UI later)

---

## 14. Implementation Notes for a Non-Expert Builder

### Conceptually hardest parts
1. **Entity linking** — deciding when to auto-link vs require manual verification. Start conservative (only link on explicit metadata match).
2. **Incremental sync cursor management** — getting the `SystemModstamp` cursor right so you don't miss records or re-process everything. Test thoroughly with small batches first.
3. **Idempotent upserts** — every sync operation must be safe to run twice. Use `prisma.upsert()` everywhere. Never `create()` for sync operations.

### What to avoid overcomplicating
- **Don't build a generic sync framework.** Write specific functions: `syncSfAccounts()`, `syncStripeCustomers()`. Copy-paste is fine. Each one is 50-80 lines.
- **Don't build a real-time event bus.** Webhooks + crons are enough for years.
- **Don't normalize to the extreme.** If SF gives you `OwnerName` denormalized on every record, store it denormalized. Don't build a `users` table just to normalize owner lookups.
- **Don't build the drift dashboard in Phase 1.** Just build the tables and syncs. You can query `sync_jobs` manually at first.

### Mistakes you're most likely to make
1. **Trying to sync everything at once.** Pick 3 tables. Get them working. Then add more.
2. **Not handling the "Stripe webhook arrives before the cron has run" race condition.** Solution: always upsert. If the webhook creates the record first, the cron will update it. If the cron creates it first, the webhook will update it. Both paths are fine.
3. **Forgetting to handle pagination in SF SOQL.** Always add `LIMIT` and handle `nextRecordsUrl`.
4. **Writing sync code that throws on error instead of logging and continuing.** A single bad record should not abort a 200-record batch. Catch per-record, log to `sync_events`, continue.
5. **Updating the UI to read from DB before the sync is reliable.** Keep the old code path as fallback for at least a week.

### What to keep simple in v1
- Entity links: metadata-match only, no fuzzy matching
- Sync frequency: 15 min for SF, webhooks for Stripe. Don't optimize further.
- Views: use regular SQL views, not materialized views. Add materialization only when queries are measurably slow.
- Monitoring: check `sync_jobs` manually. No PagerDuty integration yet.

### Decisions to lock early
1. **Table naming convention:** `sf_` prefix for Salesforce mirrors, `stripe_` for Stripe mirrors. No prefix for Omni-owned tables.
2. **ID strategy:** Use external system IDs as primary keys on mirror tables (not auto-increment). This makes upserts natural.
3. **`raw` jsonb on every mirror table:** Always store it. Storage is cheap. Debugging value is enormous.
4. **`synced_at` on every mirror table:** Always update on every sync. This is your freshness indicator.
5. **Prisma as the sole DB access layer:** Don't introduce raw SQL for sync operations. Use `prisma.$executeRaw` only for view creation and migrations.

---

## 15. Final Blueprint

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL (Runtime)                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  UI (Next.js)│  │   Webhook    │  │    Cron Jobs          │  │
│  │              │  │   Handlers   │  │                       │  │
│  │  All reads   │  │              │  │  /sync-sf-accounts    │  │
│  │  from DB  ───┼──│  Stripe ──┐  │  │  /sync-sf-opps       │  │
│  │              │  │  DocuSign  │  │  │  /reconcile-stripe   │  │
│  │  All writes  │  │           │  │  │  /refresh-views       │  │
│  │  to APIs  ───┼──┼───────┐  │  │  │          │            │  │
│  └──────────────┘  └───────┼──┼──┘  └──────────┼────────────┘  │
│         │                  │  │                 │               │
│         ▼                  ▼  ▼                 ▼               │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                   POSTGRES (Prisma)                      │   │
│  │                                                          │   │
│  │  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐  │   │
│  │  │ SF Mirrors  │  │Stripe Mirrors│  │  Omni-Owned    │  │   │
│  │  │             │  │              │  │                │  │   │
│  │  │ sf_accounts │  │stripe_custs  │  │ quote_records  │  │   │
│  │  │ sf_contacts │  │stripe_subs   │  │ entity_links   │  │   │
│  │  │ sf_opps     │  │stripe_inv    │  │ sync_jobs      │  │   │
│  │  │             │  │stripe_prods  │  │ sync_events    │  │   │
│  │  │             │  │stripe_prices │  │ audit_log      │  │   │
│  │  └──────┬──────┘  └──────┬───────┘  └────────────────┘  │   │
│  │         │                │                               │   │
│  │         ▼                ▼                               │   │
│  │  ┌─────────────────────────────────────┐                 │   │
│  │  │        Derived Views                │                 │   │
│  │  │  v_customer_360                     │                 │   │
│  │  │  v_renewal_forecast (materialized)  │                 │   │
│  │  │  v_account_health   (materialized)  │                 │   │
│  │  │  v_sync_drift                       │                 │   │
│  │  └─────────────────────────────────────┘                 │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
         │                              │
         ▼                              ▼
  ┌──────────────┐              ┌──────────────┐
  │  Salesforce   │              │    Stripe     │
  │  (SoR: CRM)  │              │  (SoR: Billing)│
  │              │              │              │
  │  Accounts    │              │  Customers   │
  │  Contacts    │              │  Subscriptions│
  │  Opps        │              │  Invoices    │
  │  Quotes (SF) │              │  Products    │
  └──────────────┘              └──────────────┘
```

### Design Decisions (locked)

1. Postgres is the single read layer for all UI surfaces
2. Salesforce owns CRM data; Stripe owns billing data; Omni owns workflow + links + derived data
3. Mirror tables use external system IDs as primary keys
4. Every mirror table stores `raw` jsonb + `synced_at` timestamp
5. Entity linking is metadata-first, with `entity_links` table for audit trail
6. SF sync is cron-based (15 min incremental). Stripe sync is webhook-based + nightly reconciliation.
7. All sync state is durable in Postgres (no in-memory state)
8. Materialized views only where query performance demands it; regular views otherwise
9. No external queue system in v1 — Postgres + Vercel crons are sufficient
10. Feature flags gate old-vs-new read paths during migration

### Build This First Checklist

- [ ] Prisma migration: `sync_jobs`, `sync_events` tables
- [ ] Prisma migration: `stripe_customers` table
- [ ] Prisma migration: `sf_accounts` table
- [ ] Prisma migration: `stripe_products`, `stripe_prices` tables
- [ ] Prisma migration: `entity_links` table
- [ ] Extend Stripe webhook handler: `customer.*` → upsert `stripe_customers`
- [ ] Extend Stripe webhook handler: `product.*`, `price.*` → upsert tables
- [ ] Cron route: `/api/cron/sync-sf-accounts` (incremental, 15 min)
- [ ] Cron route: `/api/cron/sync-stripe-products` (full, daily)
- [ ] Backfill script: one-time import of existing Stripe customers
- [ ] Backfill script: one-time import of existing SF accounts
- [ ] Auto-link: set `sf_accounts.stripe_customer_id` from Stripe customer metadata
- [ ] Migrate `/products` page to read from `stripe_products` table
- [ ] Admin page: `/admin/sync-status` showing `sync_jobs` history

### Do Not Do This Yet Checklist

- [ ] Don't build a generic sync framework or event bus
- [ ] Don't add fuzzy entity matching (name/email-based linking)
- [ ] Don't materialize views until you measure query latency
- [ ] Don't build the drift dashboard UI (query `v_sync_drift` manually)
- [ ] Don't sync Stripe charges/payment intents (invoices are sufficient)
- [ ] Don't build real-time sync (15-min cron is fine for SF)
- [ ] Don't add an external queue (Inngest/QStash) until you hit Vercel limits
- [ ] Don't try to keep SF and Stripe perfectly in sync — 15-min staleness is acceptable
- [ ] Don't build MRR trending / historical snapshots yet
- [ ] Don't over-index — add indexes only for queries you actually run