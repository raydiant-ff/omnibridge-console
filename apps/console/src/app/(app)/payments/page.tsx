import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";

export default function PaymentsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payments" />

      <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed text-muted-foreground gap-3">
        <CreditCard className="size-8" />
        <p className="text-sm">Payments coming soon</p>
      </div>
    </div>
  );
}
