import { getCustomerDirectory } from "@/lib/projections";
import { CustomersShell } from "./customers-shell";

export default async function CustomersPage() {
  const { rows, totals } = await getCustomerDirectory();
  return <CustomersShell rows={rows} totals={totals} />;
}
