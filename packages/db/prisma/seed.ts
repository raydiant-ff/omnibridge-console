import { PrismaClient, Role } from "../generated/client";
import { hashSync } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME ?? "Admin";

  if (!adminEmail || !adminPassword) {
    console.warn("⚠  ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping admin seed");
  } else {
    const passwordHash = hashSync(adminPassword, 12);
    const admin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { role: Role.admin, name: adminName, passwordHash },
      create: {
        email: adminEmail,
        name: adminName,
        role: Role.admin,
        passwordHash,
      },
    });
    console.log(`✓  Admin user: ${admin.email} (${admin.id})`);
  }

  const demoCustomer = await prisma.customerIndex.upsert({
    where: { sfAccountId: "001DEMO000000001" },
    update: {},
    create: {
      sfAccountId: "001DEMO000000001",
      sfAccountName: "Acme Corp (Demo)",
      stripeCustomerId: "cus_demo_acme",
      domain: "acme.com",
    },
  });
  console.log(`✓  Demo customer: ${demoCustomer.sfAccountName} (${demoCustomer.id})`);

  console.log("\nSeed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
