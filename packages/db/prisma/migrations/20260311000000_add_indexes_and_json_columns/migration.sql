-- Convert String columns to JSONB
ALTER TABLE "quote_records" ALTER COLUMN "line_items_json" TYPE jsonb USING "line_items_json"::jsonb;
ALTER TABLE "quote_records" ALTER COLUMN "billing_address_json" TYPE jsonb USING "billing_address_json"::jsonb;
ALTER TABLE "quote_records" ALTER COLUMN "shipping_address_json" TYPE jsonb USING "shipping_address_json"::jsonb;
ALTER TABLE "quote_records" ALTER COLUMN "existing_items_json" TYPE jsonb USING "existing_items_json"::jsonb;

-- Add missing indexes
CREATE INDEX "quote_records_stripe_customer_id_idx" ON "quote_records"("stripe_customer_id");
CREATE INDEX "quote_records_quote_type_status_idx" ON "quote_records"("quote_type", "status");
CREATE INDEX "quote_records_status_created_at_idx" ON "quote_records"("status", "created_at");
