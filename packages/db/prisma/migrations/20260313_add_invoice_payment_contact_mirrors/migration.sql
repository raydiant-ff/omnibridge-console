-- CreateTable
CREATE TABLE "stripe_invoices" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "subscription_id" TEXT,
    "number" TEXT,
    "status" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "amount_due" INTEGER NOT NULL DEFAULT 0,
    "amount_paid" INTEGER NOT NULL DEFAULT 0,
    "amount_remaining" INTEGER NOT NULL DEFAULT 0,
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "tax" INTEGER,
    "due_date" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "hosted_invoice_url" TEXT,
    "invoice_pdf" TEXT,
    "billing_reason" TEXT,
    "collection_method" TEXT,
    "period_start" TIMESTAMP(3),
    "period_end" TIMESTAMP(3),
    "metadata" JSONB,
    "raw" JSONB,
    "stripe_created" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_payments" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "invoice_id" TEXT,
    "amount" INTEGER NOT NULL DEFAULT 0,
    "amount_received" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL,
    "description" TEXT,
    "payment_method_id" TEXT,
    "card_brand" TEXT,
    "card_last4" TEXT,
    "receipt_url" TEXT,
    "metadata" JSONB,
    "raw" JSONB,
    "stripe_created" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_payment_methods" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT,
    "type" TEXT NOT NULL,
    "card_brand" TEXT,
    "card_last4" TEXT,
    "card_exp_month" INTEGER,
    "card_exp_year" INTEGER,
    "card_funding" TEXT,
    "bank_name" TEXT,
    "bank_last4" TEXT,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "raw" JSONB,
    "stripe_created" TIMESTAMP(3) NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stripe_payment_methods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sf_contacts" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "mobile_phone" TEXT,
    "title" TEXT,
    "department" TEXT,
    "mailing_city" TEXT,
    "mailing_state" TEXT,
    "mailing_country" TEXT,
    "is_bill_to" BOOLEAN NOT NULL DEFAULT false,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "raw" JSONB,
    "sf_last_modified" TIMESTAMP(3),
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sf_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stripe_invoices_customer_id_idx" ON "stripe_invoices"("customer_id");
CREATE INDEX "stripe_invoices_subscription_id_idx" ON "stripe_invoices"("subscription_id");
CREATE INDEX "stripe_invoices_status_idx" ON "stripe_invoices"("status");
CREATE INDEX "stripe_invoices_stripe_created_idx" ON "stripe_invoices"("stripe_created");

-- CreateIndex
CREATE INDEX "stripe_payments_customer_id_idx" ON "stripe_payments"("customer_id");
CREATE INDEX "stripe_payments_invoice_id_idx" ON "stripe_payments"("invoice_id");
CREATE INDEX "stripe_payments_status_idx" ON "stripe_payments"("status");
CREATE INDEX "stripe_payments_stripe_created_idx" ON "stripe_payments"("stripe_created");

-- CreateIndex
CREATE INDEX "stripe_payment_methods_customer_id_idx" ON "stripe_payment_methods"("customer_id");
CREATE INDEX "stripe_payment_methods_type_idx" ON "stripe_payment_methods"("type");

-- CreateIndex
CREATE INDEX "sf_contacts_account_id_idx" ON "sf_contacts"("account_id");
CREATE INDEX "sf_contacts_email_idx" ON "sf_contacts"("email");
CREATE INDEX "sf_contacts_sf_last_modified_idx" ON "sf_contacts"("sf_last_modified");

-- AddForeignKey
ALTER TABLE "stripe_invoices" ADD CONSTRAINT "stripe_invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "stripe_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "stripe_customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stripe_payment_methods" ADD CONSTRAINT "stripe_payment_methods_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "stripe_customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sf_contacts" ADD CONSTRAINT "sf_contacts_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "sf_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
