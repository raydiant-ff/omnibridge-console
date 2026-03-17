-- Migration: add tables that were applied via db:push without migration files.
-- These are: stripe_customers, stripe_products, stripe_prices,
--            sf_accounts, sf_contracts, sf_contract_lines,
--            sync_jobs, sync_events

-- CreateTable: sync_jobs
CREATE TABLE IF NOT EXISTS "sync_jobs" (
    "id" TEXT NOT NULL,
    "job_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "cursor" TEXT,
    "records_processed" INTEGER NOT NULL DEFAULT 0,
    "records_created" INTEGER NOT NULL DEFAULT 0,
    "records_updated" INTEGER NOT NULL DEFAULT 0,
    "records_errored" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sync_jobs_job_type_status_idx" ON "sync_jobs"("job_type", "status");
CREATE INDEX IF NOT EXISTS "sync_jobs_created_at_idx" ON "sync_jobs"("created_at");

-- CreateTable: sync_events
CREATE TABLE IF NOT EXISTS "sync_events" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "external_id" TEXT,
    "object_type" TEXT,
    "object_id" TEXT,
    "action" TEXT,
    "actor_type" TEXT,
    "actor_id" TEXT,
    "actor_name" TEXT,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sync_events_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "sync_events_source_external_id_key" ON "sync_events"("source", "external_id");
CREATE INDEX IF NOT EXISTS "sync_events_source_event_type_idx" ON "sync_events"("source", "event_type");
CREATE INDEX IF NOT EXISTS "sync_events_object_type_object_id_idx" ON "sync_events"("object_type", "object_id");
CREATE INDEX IF NOT EXISTS "sync_events_created_at_idx" ON "sync_events"("created_at");

-- CreateTable: stripe_customers
CREATE TABLE IF NOT EXISTS "stripe_customers" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "description" TEXT,
    "currency" TEXT,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "delinquent" BOOLEAN NOT NULL DEFAULT false,
    "default_payment_method" TEXT,
    "sf_account_id" TEXT,
    "metadata" JSONB,
    "raw" JSONB,
    "stripe_created" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_customers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stripe_customers_email_idx" ON "stripe_customers"("email");
CREATE INDEX IF NOT EXISTS "stripe_customers_sf_account_id_idx" ON "stripe_customers"("sf_account_id");

-- CreateTable: stripe_products
CREATE TABLE IF NOT EXISTS "stripe_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "default_price_id" TEXT,
    "sf_product_id" TEXT,
    "metadata" JSONB,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable: stripe_prices
CREATE TABLE IF NOT EXISTS "stripe_prices" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "currency" TEXT,
    "unit_amount" INTEGER,
    "billing_scheme" TEXT,
    "recurring_interval" TEXT,
    "recurring_interval_count" INTEGER NOT NULL DEFAULT 1,
    "type" TEXT,
    "nickname" TEXT,
    "metadata" JSONB,
    "raw" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stripe_prices_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "stripe_prices_product_id_idx" ON "stripe_prices"("product_id");
ALTER TABLE "stripe_prices" ADD CONSTRAINT "stripe_prices_product_id_fkey"
    FOREIGN KEY ("product_id") REFERENCES "stripe_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: sf_accounts
CREATE TABLE IF NOT EXISTS "sf_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domain" TEXT,
    "owner_id" TEXT,
    "owner_name" TEXT,
    "csm_id" TEXT,
    "csm_name" TEXT,
    "account_type" TEXT,
    "status" TEXT,
    "industry" TEXT,
    "billing_city" TEXT,
    "billing_state" TEXT,
    "billing_country" TEXT,
    "annual_revenue" DOUBLE PRECISION,
    "date_of_first_closed_won" TIMESTAMP(3),
    "stripe_customer_id" TEXT,
    "is_stub" BOOLEAN NOT NULL DEFAULT false,
    "stub_reason" TEXT,
    "hydrated_at" TIMESTAMP(3),
    "raw" JSONB,
    "sf_last_modified" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sf_accounts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sf_accounts_stripe_customer_id_idx" ON "sf_accounts"("stripe_customer_id");
CREATE INDEX IF NOT EXISTS "sf_accounts_owner_id_idx" ON "sf_accounts"("owner_id");
CREATE INDEX IF NOT EXISTS "sf_accounts_status_idx" ON "sf_accounts"("status");
CREATE INDEX IF NOT EXISTS "sf_accounts_sf_last_modified_idx" ON "sf_accounts"("sf_last_modified");
CREATE INDEX IF NOT EXISTS "sf_accounts_is_stub_idx" ON "sf_accounts"("is_stub");

-- CreateTable: sf_contracts
CREATE TABLE IF NOT EXISTS "sf_contracts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "account_name" TEXT,
    "status" TEXT NOT NULL,
    "status_code" TEXT,
    "start_date" DATE,
    "end_date" DATE,
    "contract_term" INTEGER,
    "contract_number" TEXT,
    "description" TEXT,
    "owner_id" TEXT,
    "owner_name" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_customer_id" TEXT,
    "stripe_status" TEXT,
    "stripe_quote_sf_id" TEXT,
    "stripe_schedule_id" TEXT,
    "collection_method" TEXT,
    "mrr" DOUBLE PRECISION,
    "arr" DOUBLE PRECISION,
    "opportunity_id" TEXT,
    "evergreen" BOOLEAN NOT NULL DEFAULT false,
    "do_not_renew" BOOLEAN NOT NULL DEFAULT false,
    "renewal_term" INTEGER,
    "cancellation_date" TIMESTAMP(3),
    "days_till_expiry" INTEGER,
    "activated_date" TIMESTAMP(3),
    "customer_signed_date" DATE,
    "raw" JSONB,
    "sf_last_modified" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sf_contracts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sf_contracts_account_id_idx" ON "sf_contracts"("account_id");
CREATE INDEX IF NOT EXISTS "sf_contracts_status_idx" ON "sf_contracts"("status");
CREATE INDEX IF NOT EXISTS "sf_contracts_stripe_subscription_id_idx" ON "sf_contracts"("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "sf_contracts_sf_last_modified_idx" ON "sf_contracts"("sf_last_modified");
ALTER TABLE "sf_contracts" ADD CONSTRAINT "sf_contracts_account_id_fkey"
    FOREIGN KEY ("account_id") REFERENCES "sf_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: sf_contract_lines
CREATE TABLE IF NOT EXISTS "sf_contract_lines" (
    "id" TEXT NOT NULL,
    "contract_id" TEXT NOT NULL,
    "account_id" TEXT,
    "product_id" TEXT,
    "product_name" TEXT,
    "quantity" DOUBLE PRECISION DEFAULT 1,
    "list_price" DOUBLE PRECISION,
    "net_price" DOUBLE PRECISION,
    "start_date" DATE,
    "end_date" DATE,
    "status" TEXT,
    "billing_frequency" TEXT,
    "stripe_sub_item_id" TEXT,
    "stripe_price_id" TEXT,
    "stripe_product_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_status" TEXT,
    "mrr" DOUBLE PRECISION,
    "arr" DOUBLE PRECISION,
    "raw" JSONB,
    "sf_last_modified" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sf_contract_lines_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "sf_contract_lines_contract_id_idx" ON "sf_contract_lines"("contract_id");
CREATE INDEX IF NOT EXISTS "sf_contract_lines_stripe_sub_item_id_idx" ON "sf_contract_lines"("stripe_sub_item_id");
CREATE INDEX IF NOT EXISTS "sf_contract_lines_stripe_subscription_id_idx" ON "sf_contract_lines"("stripe_subscription_id");
CREATE INDEX IF NOT EXISTS "sf_contract_lines_sf_last_modified_idx" ON "sf_contract_lines"("sf_last_modified");
ALTER TABLE "sf_contract_lines" ADD CONSTRAINT "sf_contract_lines_contract_id_fkey"
    FOREIGN KEY ("contract_id") REFERENCES "sf_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
