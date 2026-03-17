-- Reconcile drift between db:push state and migration history.
-- These changes align the live DB with what the migration chain now expects.

-- Fix effective_date type: was created as TIMESTAMPTZ, Prisma expects TIMESTAMP(3)
ALTER TABLE "quote_records"
  ALTER COLUMN "effective_date" TYPE TIMESTAMP(3) USING "effective_date" AT TIME ZONE 'UTC';

-- Set updated_at defaults on mirror tables (db:push did not set these)
ALTER TABLE "sf_accounts" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sf_contract_lines" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "sf_contracts" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "stripe_customers" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "stripe_prices" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "stripe_products" ALTER COLUMN "updated_at" SET DEFAULT CURRENT_TIMESTAMP;

-- Add missing indexes that exist in DB but were not in any migration file
CREATE INDEX IF NOT EXISTS "quote_records_docusign_envelope_id_idx" ON "quote_records"("docusign_envelope_id");
CREATE INDEX IF NOT EXISTS "quote_records_parent_subscription_id_idx" ON "quote_records"("parent_subscription_id");
