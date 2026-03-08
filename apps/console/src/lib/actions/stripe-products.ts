"use server";

import { requireSession } from "@omnibridge/auth";
import { invalidateTag } from "@/lib/cache";
import { writeProductLog } from "@/lib/product-log";

export async function deactivateStripeProducts(
  productIds: string[],
): Promise<{ success: string[]; failed: { id: string; error: string }[] }> {
  const session = await requireSession();
  const user = session.user as { id?: string; role?: string; email?: string };
  const role = user.role ?? "member";
  if (role !== "admin") {
    throw new Error("Forbidden: only admins can deactivate products");
  }

  const { getStripeClient } = await import("@omnibridge/stripe");
  const stripe = getStripeClient();

  const success: string[] = [];
  const failed: { id: string; error: string }[] = [];

  await Promise.allSettled(
    productIds.map(async (id) => {
      try {
        const product = await stripe.products.update(id, { active: false });
        success.push(id);
        await writeProductLog({
          source: "omnibridge",
          action: "deactivated",
          productId: id,
          productName: product.name,
          actorType: "user",
          actorId: user.id ?? user.email ?? undefined,
          detail: { triggeredBy: user.email },
        });
      } catch (err) {
        failed.push({
          id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }),
  );

  invalidateTag("stripe-products");

  return { success, failed };
}
