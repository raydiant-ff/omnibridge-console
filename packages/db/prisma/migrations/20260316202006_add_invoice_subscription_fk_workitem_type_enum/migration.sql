/*
  Warnings:

  - Changed the type of `type` on the `work_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "work_items" DROP COLUMN "type",
ADD COLUMN     "type" "WorkItemType" NOT NULL;

-- CreateIndex
CREATE INDEX "work_items_type_status_idx" ON "work_items"("type", "status");

-- AddForeignKey
ALTER TABLE "stripe_invoices" ADD CONSTRAINT "stripe_invoices_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "stripe_subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
