import { prisma } from "@omnibridge/db";
import { writeProductLog } from "@/lib/product-log";
import type { SfdcProduct } from "@/lib/queries/sfdc-products";

interface SfdcSnapshot {
  id: string;
  name: string;
  active: boolean;
}

const snapshotCache = new Map<string, SfdcSnapshot>();
let initialized = false;

async function loadSnapshotFromDb() {
  if (initialized) return;

  const existing = await prisma.productLog.findMany({
    where: { source: "salesforce" },
    orderBy: { createdAt: "desc" },
    distinct: ["productId"],
    select: { productId: true, productName: true, action: true },
  });

  for (const log of existing) {
    const active = log.action !== "deactivated" && log.action !== "deleted";
    snapshotCache.set(log.productId, {
      id: log.productId,
      name: log.productName ?? "",
      active,
    });
  }

  initialized = true;
}

export async function detectSfdcProductChanges(
  currentProducts: SfdcProduct[],
): Promise<number> {
  await loadSnapshotFromDb();

  let logged = 0;
  const currentIds = new Set<string>();

  for (const product of currentProducts) {
    currentIds.add(product.id);
    const prev = snapshotCache.get(product.id);

    if (!prev) {
      await writeProductLog({
        source: "salesforce",
        action: "created",
        productId: product.id,
        productName: product.name,
        actorType: product.lastModifiedBy ? "user" : "system",
        actorId: product.lastModifiedBy ?? undefined,
        detail: {
          productCode: product.productCode,
          family: product.family,
          active: product.active,
          ...(product.stripeProductId ? { stripeProductId: product.stripeProductId } : {}),
        },
      });
      logged++;
    } else if (prev.active !== product.active) {
      await writeProductLog({
        source: "salesforce",
        action: product.active ? "activated" : "deactivated",
        productId: product.id,
        productName: product.name,
        actorType: product.lastModifiedBy ? "user" : "system",
        actorId: product.lastModifiedBy ?? undefined,
        detail: {
          previousActive: prev.active,
          currentActive: product.active,
          ...(product.stripeProductId ? { stripeProductId: product.stripeProductId } : {}),
        },
      });
      logged++;
    }

    snapshotCache.set(product.id, {
      id: product.id,
      name: product.name,
      active: product.active,
    });
  }

  return logged;
}
