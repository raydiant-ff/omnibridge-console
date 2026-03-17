import { PrismaClient } from "../packages/db/generated/client/index.js";
const prisma = new PrismaClient();

async function main() {
  const id = "001WQ00001OHG3dYAH";
  const account = await prisma.sfAccount.findUnique({ where: { id }, select: { id: true, name: true, isStub: true, stripeCustomerId: true } });
  console.log("account:", JSON.stringify(account));

  // Also check a sample of real IDs
  const sample = await prisma.sfAccount.findMany({
    take: 3,
    where: { isStub: false, stripeCustomerId: { not: null } },
    select: { id: true, name: true, stripeCustomerId: true },
  });
  console.log("sample non-stub accounts:", JSON.stringify(sample, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
