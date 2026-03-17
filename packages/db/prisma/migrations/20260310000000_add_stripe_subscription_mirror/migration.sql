-- CreateTable
CREATE TABLE "stripe_subscriptions" (
    "id" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "collection_method" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "current_period_start" TIMESTAMP(3) NOT NULL,
    "current_period_end" TIMESTAMP(3) NOT NULL,
    "cancel_at_period_end" BOOLEAN NOT NULL DEFAULT false,
    "cancel_at" TIMESTAMP(3),
    "canceled_at" TIMESTAMP(3),
    "trial_start" TIMESTAMP(3),
    "trial_end" TIMESTAMP(3),
    "start_date" TIMESTAMP(3) NOT NULL,
    "created" TIMESTAMP(3) NOT NULL,
    "billing_cycle_anchor" TIMESTAMP(3) NOT NULL,
    "has_schedule" BOOLEAN NOT NULL DEFAULT false,
    "has_discount" BOOLEAN NOT NULL DEFAULT false,
    "has_payment_method" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stripe_subscription_items" (
    "id" TEXT NOT NULL,
    "subscription_id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "price_id" TEXT NOT NULL,
    "unit_amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "billing_interval" TEXT,
    "interval_count" INTEGER NOT NULL DEFAULT 1,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "usage_type" TEXT NOT NULL DEFAULT 'licensed',
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stripe_subscription_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stripe_subscriptions_status_idx" ON "stripe_subscriptions"("status");

-- CreateIndex
CREATE INDEX "stripe_subscriptions_customer_id_idx" ON "stripe_subscriptions"("customer_id");

-- CreateIndex
CREATE INDEX "stripe_subscription_items_subscription_id_idx" ON "stripe_subscription_items"("subscription_id");

-- AddForeignKey
ALTER TABLE "stripe_subscription_items" ADD CONSTRAINT "stripe_subscription_items_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "stripe_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
