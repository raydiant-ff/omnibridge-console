-- Add address fields to quote_records table
ALTER TABLE "quote_records" ADD COLUMN "billing_address_json" TEXT;
ALTER TABLE "quote_records" ADD COLUMN "shipping_address_json" TEXT;