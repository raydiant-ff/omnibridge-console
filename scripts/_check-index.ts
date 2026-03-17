async function main() {
  const { prisma } = await import("@omnibridge/db");
  const count = await prisma.customerIndex.count();
  const sample = await prisma.customerIndex.findMany({ take: 5, select: { id: true, sfAccountId: true, sfAccountName: true } });
  console.log('count:', count);
  console.log(JSON.stringify(sample, null, 2));
  await prisma.$disconnect();
}
main().catch(console.error);
