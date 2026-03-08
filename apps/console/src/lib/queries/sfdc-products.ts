"use server";

import { cached } from "@/lib/cache";
import { flags } from "@/lib/feature-flags";

export interface SfdcProduct {
  id: string;
  name: string;
  productCode: string | null;
  description: string | null;
  active: boolean;
  family: string | null;
  createdDate: string;
  lastModifiedDate: string;
  lastModifiedBy: string | null;
  stripeProductId: string | null;
  stripePriceId: string | null;
  pricebookEntries: SfdcPricebookEntry[];
}

export interface SfdcPricebookEntry {
  id: string;
  unitPrice: number;
  active: boolean;
  pricebookName: string;
}

const MOCK_SFDC_PRODUCTS: SfdcProduct[] = [
  {
    id: "01tMOCK001",
    name: "Starter Plan",
    productCode: "PLAN-STARTER",
    description: "For small teams getting started",
    active: true,
    family: "Software",
    createdDate: "2024-01-15T00:00:00.000Z",
    lastModifiedDate: "2024-06-01T00:00:00.000Z",
    lastModifiedBy: "Admin User",
    stripeProductId: "prod_mock_starter",
    stripePriceId: "price_mock_starter_mo",
    pricebookEntries: [
      { id: "01sMOCK001", unitPrice: 29, active: true, pricebookName: "Standard" },
    ],
  },
  {
    id: "01tMOCK002",
    name: "Pro Plan",
    productCode: "PLAN-PRO",
    description: "For growing businesses",
    active: true,
    family: "Software",
    createdDate: "2024-01-15T00:00:00.000Z",
    lastModifiedDate: "2024-06-01T00:00:00.000Z",
    lastModifiedBy: "Admin User",
    stripeProductId: "prod_mock_pro",
    stripePriceId: "price_mock_pro_mo",
    pricebookEntries: [
      { id: "01sMOCK002", unitPrice: 99, active: true, pricebookName: "Standard" },
    ],
  },
];

async function _fetchSfdcProductsFromApi(): Promise<SfdcProduct[]> {
  const { getProducts, getAllPricebookEntries } = await import("@omnibridge/salesforce");

  const [products, entries] = await Promise.all([
    getProducts(),
    getAllPricebookEntries(),
  ]);

  const entriesByProduct = new Map<string, SfdcPricebookEntry[]>();
  for (const e of entries) {
    const existing = entriesByProduct.get(e.Product2Id) ?? [];
    existing.push({
      id: e.Id,
      unitPrice: e.UnitPrice,
      active: e.IsActive,
      pricebookName: e.Pricebook2.Name,
    });
    entriesByProduct.set(e.Product2Id, existing);
  }

  return products.map((p) => ({
    id: p.Id,
    name: p.Name,
    productCode: p.ProductCode,
    description: p.Description,
    active: p.IsActive,
    family: p.Family,
    createdDate: p.CreatedDate,
    lastModifiedDate: p.LastModifiedDate,
    lastModifiedBy: p.LastModifiedBy?.Name ?? null,
    stripeProductId: p.Stripe_Product_ID__c,
    stripePriceId: p.Stripe_Price_ID__c,
    pricebookEntries: entriesByProduct.get(p.Id) ?? [],
  }));
}

export async function fetchSfdcProducts(): Promise<SfdcProduct[]> {
  if (flags.useMockSalesforce) return MOCK_SFDC_PRODUCTS;
  return cached(_fetchSfdcProductsFromApi, "sfdc-products", {
    revalidate: 300,
    tags: ["sfdc-products"],
  });
}
