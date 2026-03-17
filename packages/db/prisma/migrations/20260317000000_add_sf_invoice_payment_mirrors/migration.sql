-- CreateTable: sf_invoices — minimal SF invoice mirror (active customers only)
CREATE TABLE "sf_invoices" (
    "id" TEXT NOT NULL,
    "sf_id" TEXT NOT NULL,
    "sf_account_id" TEXT NOT NULL,
    "invoice_number" TEXT,
    "status" TEXT,
    "invoice_date" DATE,
    "due_date" DATE,
    "total_amount" DOUBLE PRECISION,
    "currency" TEXT,
    "external_url" TEXT,
    "raw_json" JSONB,
    "sf_last_modified" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sf_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: sf_payments — minimal SF payment mirror (active customers only)
CREATE TABLE "sf_payments" (
    "id" TEXT NOT NULL,
    "sf_id" TEXT NOT NULL,
    "sf_account_id" TEXT NOT NULL,
    "sf_invoice_id" TEXT,
    "payment_date" DATE,
    "amount" DOUBLE PRECISION,
    "currency" TEXT,
    "status" TEXT,
    "payment_method" TEXT,
    "reference_id" TEXT,
    "external_url" TEXT,
    "raw_json" JSONB,
    "sf_last_modified" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sf_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "sf_invoices_sf_id_key" ON "sf_invoices"("sf_id");
CREATE INDEX "sf_invoices_sf_account_id_idx" ON "sf_invoices"("sf_account_id");
CREATE INDEX "sf_invoices_status_idx" ON "sf_invoices"("status");
CREATE INDEX "sf_invoices_invoice_date_idx" ON "sf_invoices"("invoice_date");

-- CreateIndex
CREATE UNIQUE INDEX "sf_payments_sf_id_key" ON "sf_payments"("sf_id");
CREATE INDEX "sf_payments_sf_account_id_idx" ON "sf_payments"("sf_account_id");
CREATE INDEX "sf_payments_status_idx" ON "sf_payments"("status");
CREATE INDEX "sf_payments_payment_date_idx" ON "sf_payments"("payment_date");

-- AddForeignKey
ALTER TABLE "sf_invoices" ADD CONSTRAINT "sf_invoices_sf_account_id_fkey"
    FOREIGN KEY ("sf_account_id") REFERENCES "sf_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sf_payments" ADD CONSTRAINT "sf_payments_sf_account_id_fkey"
    FOREIGN KEY ("sf_account_id") REFERENCES "sf_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
