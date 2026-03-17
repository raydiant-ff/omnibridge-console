import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";

export default function InvoicesPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Invoices" />

      <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed text-muted-foreground gap-3">
        <Receipt className="size-8" />
        <p className="text-sm">Invoices coming soon</p>
      </div>
    </div>
  );
}
