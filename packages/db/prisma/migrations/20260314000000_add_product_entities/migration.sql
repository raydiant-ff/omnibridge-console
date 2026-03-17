-- Add product layer entities: enums, Renewal, CustomerNote, AccountSignal.
-- Also drops pandadoc_document_id from quote_records (zero code references, confirmed safe).

-- CreateEnum: WorkItemType
CREATE TYPE "WorkItemType" AS ENUM ('renewal_follow_up', 'quote_review', 'billing_issue', 'customer_task', 'ops_exception');

-- CreateEnum: RenewalStatus
CREATE TYPE "RenewalStatus" AS ENUM ('not_started', 'in_progress', 'quote_sent', 'won', 'lost', 'churned');

-- CreateEnum: SignalSeverity
CREATE TYPE "SignalSeverity" AS ENUM ('info', 'warning', 'critical');

-- DropColumn: pandadoc_document_id (removed from schema, zero code references)
ALTER TABLE "quote_records" DROP COLUMN IF EXISTS "pandadoc_document_id";

-- CreateTable: renewals
CREATE TABLE "renewals" (
    "id" TEXT NOT NULL,
    "customer_index_id" TEXT NOT NULL,
    "sf_contract_id" TEXT,
    "stripe_subscription_id" TEXT,
    "quote_record_id" TEXT,
    "owner_user_id" TEXT,
    "status" "RenewalStatus" NOT NULL DEFAULT 'not_started',
    "target_renewal_date" TIMESTAMP(3) NOT NULL,
    "at_risk" BOOLEAN NOT NULL DEFAULT false,
    "notes_summary" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "renewals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "renewals_customer_index_id_idx" ON "renewals"("customer_index_id");
CREATE INDEX "renewals_status_idx" ON "renewals"("status");
CREATE INDEX "renewals_target_renewal_date_idx" ON "renewals"("target_renewal_date");
CREATE INDEX "renewals_sf_contract_id_idx" ON "renewals"("sf_contract_id");
CREATE INDEX "renewals_stripe_subscription_id_idx" ON "renewals"("stripe_subscription_id");
CREATE INDEX "renewals_owner_user_id_idx" ON "renewals"("owner_user_id");

-- AddForeignKey
ALTER TABLE "renewals" ADD CONSTRAINT "renewals_customer_index_id_fkey"
    FOREIGN KEY ("customer_index_id") REFERENCES "customer_index"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "renewals" ADD CONSTRAINT "renewals_owner_user_id_fkey"
    FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateTable: customer_notes
CREATE TABLE "customer_notes" (
    "id" TEXT NOT NULL,
    "customer_index_id" TEXT NOT NULL,
    "author_user_id" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_notes_customer_index_id_idx" ON "customer_notes"("customer_index_id");
CREATE INDEX "customer_notes_author_user_id_idx" ON "customer_notes"("author_user_id");
CREATE INDEX "customer_notes_pinned_idx" ON "customer_notes"("pinned");
CREATE INDEX "customer_notes_created_at_idx" ON "customer_notes"("created_at");

-- AddForeignKey
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_customer_index_id_fkey"
    FOREIGN KEY ("customer_index_id") REFERENCES "customer_index"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "customer_notes" ADD CONSTRAINT "customer_notes_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateTable: account_signals
CREATE TABLE "account_signals" (
    "id" TEXT NOT NULL,
    "customer_index_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" "SignalSeverity" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "source" TEXT NOT NULL,
    "payload_json" JSONB,
    "computed_at" TIMESTAMP(3) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_signals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "account_signals_customer_index_id_idx" ON "account_signals"("customer_index_id");
CREATE INDEX "account_signals_type_idx" ON "account_signals"("type");
CREATE INDEX "account_signals_severity_idx" ON "account_signals"("severity");
CREATE INDEX "account_signals_status_idx" ON "account_signals"("status");
CREATE INDEX "account_signals_computed_at_idx" ON "account_signals"("computed_at");
CREATE INDEX "account_signals_expires_at_idx" ON "account_signals"("expires_at");

-- AddForeignKey
ALTER TABLE "account_signals" ADD CONSTRAINT "account_signals_customer_index_id_fkey"
    FOREIGN KEY ("customer_index_id") REFERENCES "customer_index"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
