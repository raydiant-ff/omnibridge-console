CREATE INDEX IF NOT EXISTS "renewals_customer_index_id_target_renewal_date_idx"
ON "renewals"("customer_index_id", "target_renewal_date");
