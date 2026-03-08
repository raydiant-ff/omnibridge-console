-- CreateTable
CREATE TABLE "product_logs" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "detail" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quote_records" (
    "id" TEXT NOT NULL,
    "stripe_quote_id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "stripe_customer_id" TEXT NOT NULL,
    "sf_account_id" TEXT,
    "opportunity_id" TEXT,
    "sf_quote_id" TEXT,
    "collection_method" TEXT NOT NULL,
    "payment_terms" TEXT,
    "days_until_due" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "accept_token" TEXT NOT NULL,
    "accepted_at" TIMESTAMP(3),
    "total_amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "expires_at" TIMESTAMP(3),
    "pdf_url" TEXT,
    "line_items_json" TEXT,
    "pandadoc_document_id" TEXT,
    "signer_name" TEXT,
    "signer_email" TEXT,
    "contract_term" TEXT,
    "billing_frequency" TEXT,
    "contract_end_date" TIMESTAMP(3),
    "stripe_schedule_id" TEXT,
    "stripe_subscription_id" TEXT,
    "stripe_sub_item_ids" JSONB,
    "stripe_quote_number" TEXT,
    "sf_quote_number" TEXT,
    "sf_contract_id" TEXT,
    "sf_subscription_ids" JSONB,
    "sf_quote_line_ids" JSONB,
    "dry_run" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quote_records_pkey" PRIMARY KEY ("id")
);

-- AlterTable: make audit_log.actor_user_id optional
ALTER TABLE "audit_log" ALTER COLUMN "actor_user_id" DROP NOT NULL;

-- DropForeignKey (will recreate with SET NULL)
ALTER TABLE "audit_log" DROP CONSTRAINT "audit_log_actor_user_id_fkey";

-- AddForeignKey (nullable, SET NULL on delete)
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "product_logs_source_idx" ON "product_logs"("source");

-- CreateIndex
CREATE INDEX "product_logs_action_idx" ON "product_logs"("action");

-- CreateIndex
CREATE INDEX "product_logs_product_id_idx" ON "product_logs"("product_id");

-- CreateIndex
CREATE INDEX "product_logs_created_at_idx" ON "product_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "quote_records_stripe_quote_id_key" ON "quote_records"("stripe_quote_id");

-- CreateIndex
CREATE UNIQUE INDEX "quote_records_accept_token_key" ON "quote_records"("accept_token");

-- CreateIndex
CREATE INDEX "quote_records_status_idx" ON "quote_records"("status");

-- CreateIndex
CREATE INDEX "quote_records_customer_id_idx" ON "quote_records"("customer_id");

-- CreateIndex
CREATE INDEX "quote_records_opportunity_id_idx" ON "quote_records"("opportunity_id");

-- CreateIndex
CREATE INDEX "quote_records_sf_quote_id_idx" ON "quote_records"("sf_quote_id");

-- CreateIndex
CREATE INDEX "quote_records_created_by_idx" ON "quote_records"("created_by");

-- AddForeignKey
ALTER TABLE "quote_records" ADD CONSTRAINT "quote_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
