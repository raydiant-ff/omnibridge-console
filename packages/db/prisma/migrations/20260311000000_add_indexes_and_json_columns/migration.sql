-- Add columns that were pushed directly (db:push) without a migration file
ALTER TABLE "quote_records" ADD COLUMN IF NOT EXISTS "quote_type" TEXT NOT NULL DEFAULT 'new';
ALTER TABLE "quote_records" ADD COLUMN IF NOT EXISTS "existing_items_json" TEXT;
ALTER TABLE "quote_records" ADD COLUMN IF NOT EXISTS "docusign_envelope_id" TEXT;
ALTER TABLE "quote_records" ADD COLUMN IF NOT EXISTS "parent_subscription_id" TEXT;
ALTER TABLE "quote_records" ADD COLUMN IF NOT EXISTS "parent_schedule_id" TEXT;
ALTER TABLE "quote_records" ADD COLUMN IF NOT EXISTS "effective_timing" TEXT;
ALTER TABLE "quote_records" ADD COLUMN IF NOT EXISTS "proration_amount_cents" INTEGER;

-- Convert String columns to JSONB
ALTER TABLE "quote_records" ALTER COLUMN "line_items_json" TYPE jsonb USING "line_items_json"::jsonb;
ALTER TABLE "quote_records" ALTER COLUMN "billing_address_json" TYPE jsonb USING "billing_address_json"::jsonb;
ALTER TABLE "quote_records" ALTER COLUMN "shipping_address_json" TYPE jsonb USING "shipping_address_json"::jsonb;
ALTER TABLE "quote_records" ALTER COLUMN "existing_items_json" TYPE jsonb USING "existing_items_json"::jsonb;

-- Add missing indexes
CREATE INDEX "quote_records_stripe_customer_id_idx" ON "quote_records"("stripe_customer_id");
CREATE INDEX "quote_records_quote_type_status_idx" ON "quote_records"("quote_type", "status");
CREATE INDEX "quote_records_status_created_at_idx" ON "quote_records"("status", "created_at");
