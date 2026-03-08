"use server";

import { invalidateTag } from "@/lib/cache";

export async function revalidateProducts() {
  invalidateTag("stripe-products");
  invalidateTag("sfdc-products");
}

export async function revalidateCustomers() {
  invalidateTag("my-accounts");
  invalidateTag("all-accounts");
  invalidateTag("account-detail");
  invalidateTag("stripe-customer");
}
