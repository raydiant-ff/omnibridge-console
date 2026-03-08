import { PrismaClient } from "../generated/client";

const prisma = new PrismaClient();

function normalizeDomain(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    let d = raw.trim().toLowerCase();
    if (!d.startsWith("http")) d = `https://${d}`;
    const host = new URL(d).hostname.replace(/^www\./, "");
    return host || null;
  } catch {
    return null;
  }
}

interface StripeCustomerRecord {
  stripeId: string;
  name: string | null;
  domain: string | null;
}

interface SFAccountRecord {
  sfId: string;
  name: string | null;
  domain: string | null;
}

// ---------------------------------------------------------------------------
// Phase 1: Stripe
// ---------------------------------------------------------------------------
async function fetchStripeCustomers(): Promise<StripeCustomerRecord[]> {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.warn("⚠  STRIPE_SECRET_KEY not set — skipping Stripe import");
    return [];
  }

  // Dynamic import so the script doesn't fail if stripe pkg isn't resolved
  const Stripe = (await import("stripe")).default;
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const records: StripeCustomerRecord[] = [];
  let hasMore = true;
  let startingAfter: string | undefined;

  console.log("  Fetching Stripe customers...");
  while (hasMore) {
    const page = await stripe.customers.list({
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    });

    for (const c of page.data) {
      if (c.deleted) continue;
      const emailDomain = c.email ? normalizeDomain(c.email.split("@")[1]) : null;
      records.push({
        stripeId: c.id,
        name: c.name ?? c.email ?? null,
        domain: emailDomain,
      });
    }

    hasMore = page.has_more;
    if (page.data.length > 0) {
      startingAfter = page.data[page.data.length - 1].id;
    }
  }

  console.log(`  ✓ Fetched ${records.length} Stripe customers`);
  return records;
}

// ---------------------------------------------------------------------------
// Phase 2: Salesforce
// ---------------------------------------------------------------------------
async function fetchSalesforceAccounts(): Promise<SFAccountRecord[]> {
  const requiredVars = ["SF_CLIENT_ID", "SF_USERNAME", "SF_PRIVATE_KEY_BASE64"];
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.warn(`⚠  ${missing.join(", ")} not set — skipping Salesforce import`);
    return [];
  }

  const { soql } = await import("@omnibridge/salesforce");

  console.log("  Fetching Salesforce accounts...");
  interface SFAccount {
    Id: string;
    Name: string;
    Website: string | null;
  }

  const accounts = await soql<SFAccount>(
    "SELECT Id, Name, Website FROM Account ORDER BY Name",
  );

  const records: SFAccountRecord[] = accounts.map((a) => ({
    sfId: a.Id,
    name: a.Name,
    domain: normalizeDomain(a.Website),
  }));

  console.log(`  ✓ Fetched ${records.length} Salesforce accounts`);
  return records;
}

// ---------------------------------------------------------------------------
// Phase 3: Merge & Upsert
// ---------------------------------------------------------------------------
async function mergeAndUpsert(
  stripeRecords: StripeCustomerRecord[],
  sfRecords: SFAccountRecord[],
) {
  // Build domain -> SF account map for matching
  const sfByDomain = new Map<string, SFAccountRecord>();
  for (const sf of sfRecords) {
    if (sf.domain) sfByDomain.set(sf.domain, sf);
  }

  const matchedSfIds = new Set<string>();
  let created = 0;
  let updated = 0;
  let matched = 0;

  // Upsert Stripe customers, matching to SF by domain when possible
  for (const sc of stripeRecords) {
    const sfMatch = sc.domain ? sfByDomain.get(sc.domain) : undefined;
    if (sfMatch) {
      matchedSfIds.add(sfMatch.sfId);
      matched++;
    }

    await prisma.customerIndex.upsert({
      where: { stripeCustomerId: sc.stripeId },
      update: {
        sfAccountName: sfMatch?.name ?? sc.name,
        domain: sc.domain,
        ...(sfMatch ? { sfAccountId: sfMatch.sfId } : {}),
      },
      create: {
        stripeCustomerId: sc.stripeId,
        sfAccountId: sfMatch?.sfId ?? null,
        sfAccountName: sfMatch?.name ?? sc.name,
        domain: sc.domain,
      },
    });
    created++;
  }

  // Upsert remaining SF accounts that didn't match any Stripe customer
  for (const sf of sfRecords) {
    if (matchedSfIds.has(sf.sfId)) continue;

    await prisma.customerIndex.upsert({
      where: { sfAccountId: sf.sfId },
      update: {
        sfAccountName: sf.name,
        domain: sf.domain,
      },
      create: {
        sfAccountId: sf.sfId,
        sfAccountName: sf.name,
        domain: sf.domain,
      },
    });
    created++;
  }

  console.log(
    `\n  Summary: ${created} upserted, ${matched} matched by domain`,
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n🔄 Customer Import\n");

  const [stripeRecords, sfRecords] = await Promise.all([
    fetchStripeCustomers(),
    fetchSalesforceAccounts(),
  ]);

  if (stripeRecords.length === 0 && sfRecords.length === 0) {
    console.log("\n  No records fetched from either source. Nothing to import.");
    return;
  }

  await mergeAndUpsert(stripeRecords, sfRecords);

  const total = await prisma.customerIndex.count();
  console.log(`  Total customers in index: ${total}\n`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
