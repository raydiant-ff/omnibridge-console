import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/workspace/page-header";

export default function PaymentMethodsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Payment Methods" />

      <div className="flex flex-col items-center justify-center h-64 rounded-xl border border-dashed text-muted-foreground gap-3">
        <Wallet className="size-8" />
        <p className="text-sm">Payment Methods coming soon</p>
      </div>
    </div>
  );
}
