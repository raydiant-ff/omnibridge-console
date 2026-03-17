import { PrismaClient } from "../packages/db/generated/client/index.js";
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.customerIndex.count();
  const sample = await prisma.customerIndex.findMany({
    take: 5,
    select: { id: true, sfAccountId: true, sfAccountName: true, stripeCustomerId: true },
  });
  console.log("total rows:", count);
  console.log(JSON.stringify(sample, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
