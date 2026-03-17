import { PrismaClient } from "../packages/db/generated/client/index.js";
const prisma = new PrismaClient();

async function main() {
  const sfCount = await prisma.sfAccount.count();
  const sample = await prisma.sfAccount.findMany({
    take: 3,
    where: { isStub: false },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  console.log("sf_accounts count:", sfCount);
  console.log(JSON.stringify(sample, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
