-- Add correlation and customer_id fields to stripe_subscription_items

ALTER TABLE "stripe_subscription_items" ADD COLUMN "customer_id" TEXT;
ALTER TABLE "stripe_subscription_items" ADD COLUMN "sf_contract_line_id" TEXT;
ALTER TABLE "stripe_subscription_items" ADD COLUMN "correlation_status" TEXT NOT NULL DEFAULT 'unmatched';
ALTER TABLE "stripe_subscription_items" ADD COLUMN "correlation_method" TEXT;

CREATE INDEX "stripe_subscription_items_customer_id_idx" ON "stripe_subscription_items"("customer_id");
CREATE INDEX "stripe_subscription_items_sf_contract_line_id_idx" ON "stripe_subscription_items"("sf_contract_line_id");
