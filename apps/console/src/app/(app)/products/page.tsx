import { fetchStripeProducts } from "@/lib/queries/stripe-products";
import { fetchSfdcProducts } from "@/lib/queries/sfdc-products";
import { getProductLogs } from "@/lib/queries/product-logs";
import { detectSfdcProductChanges } from "@/lib/sfdc-product-poller";
import { revalidateProducts } from "@/lib/actions/revalidate";
import { RefreshButton } from "@/components/refresh-button";
import { ProductCatalogTabs } from "./product-tabs";
import { PageHeader } from "@/components/workspace";

async function getSessionRole(): Promise<string> {
  try {
    const { requireSession } = await import("@omnibridge/auth");
    const session = await requireSession();
    return (session.user as { role?: string }).role ?? "member";
  } catch {
    return "member";
  }
}

export default async function ProductCatalogPage() {
  const [stripeProducts, sfdcProducts, role] = await Promise.all([
    fetchStripeProducts(),
    fetchSfdcProducts(),
    getSessionRole(),
  ]);

  // Run SFDC change detection in the background (non-blocking)
  detectSfdcProductChanges(sfdcProducts).catch(() => {});

  const [stripeLogs, sfdcLogs] = await Promise.all([
    getProductLogs(["stripe", "omnibridge"]),
    getProductLogs("salesforce"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Product Catalog"
        description="Manage products across Salesforce and Stripe."
        actions={<RefreshButton action={revalidateProducts} />}
      />

      <ProductCatalogTabs
        stripeProducts={stripeProducts}
        sfdcProducts={sfdcProducts}
        isAdmin={role === "admin"}
        stripeLogs={stripeLogs}
        sfdcLogs={sfdcLogs}
      />
    </div>
  );
}
