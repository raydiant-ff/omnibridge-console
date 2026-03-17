-- Add bill_to_contact_id and effective_date to quote_records
ALTER TABLE "quote_records" ADD COLUMN "bill_to_contact_id" TEXT;
ALTER TABLE "quote_records" ADD COLUMN "effective_date" TIMESTAMPTZ;
