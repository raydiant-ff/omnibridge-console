import { PrismaClient } from "../packages/db/generated/client/index.js";
const prisma = new PrismaClient();

async function main() {
  // Check sync events for the 5 subscriptions
  const syncEvents = await prisma.syncEvent.findMany({
    where: {
      createdAt: { gte: new Date("2026-03-12T00:00:00Z") },
      OR: [
        { objectId: "sub_1TAA29L2h1aq04cKCBSJbAs3" },
        { objectId: "sub_1TAAHsL2h1aq04cK3Q5sjrI6" },
        { objectId: "sub_1TAAmXL2h1aq04cKBXrG4olP" },
        { objectId: "sub_1TABjmL2h1aq04cK35zwoLRV" },
        { objectId: "sub_1TADcxL2h1aq04cKliigm7t0" },
        { objectId: "cus_T42gF0rGjIkpul" },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  console.log(`=== Sync Events (${syncEvents.length}) ===`);
  for (const e of syncEvents) {
    console.log(`  ${e.createdAt.toISOString()}  source=${e.source}  type=${e.objectType}  id=${e.objectId}  action=${e.action}  ok=${e.success}`);
  }

  // Check for QuoteRecord
  const quoteRecords = await prisma.quoteRecord.findMany({
    where: {
      OR: [
        { stripeCustomerId: "cus_T42gF0rGjIkpul" },
      ],
    },
    take: 10,
  });
  console.log(`\n=== Quote Records (${quoteRecords.length}) ===`);
  for (const q of quoteRecords) {
    console.log(`  ${q.id}  type=${q.quoteType}  status=${q.status}  stripeQuote=${q.stripeQuoteId}  sfContract=${q.sfContractId}  created=${q.createdAt.toISOString()}`);
  }

  // Check StripeSubscription mirror
  const subs = await prisma.stripeSubscription.findMany({
    where: { customerId: "cus_T42gF0rGjIkpul" },
    include: { items: true },
  });
  console.log(`\n=== Stripe Subscription Mirror (${subs.length}) ===`);
  for (const s of subs) {
    console.log(`  ${s.id}  status=${s.status}  items=${s.items.length}  synced=${s.syncedAt.toISOString()}`);
  }

  await prisma.$disconnect();
}
main();
