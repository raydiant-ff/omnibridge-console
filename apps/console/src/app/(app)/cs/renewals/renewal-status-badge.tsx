import { Badge } from "@/components/ui/badge";

const STATUS_CONFIG: Record<string, { label: string; variant: "destructive" | "secondary" | "outline" }> = {
  cancelling: { label: "Cancelling", variant: "destructive" },
  scheduled_end: { label: "Schedule Ending", variant: "secondary" },
  period_ending: { label: "Period Ending", variant: "outline" },
};

export function RenewalStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? { label: status, variant: "secondary" as const };
  return (
    <Badge variant={cfg.variant} className="text-xs">
      {cfg.label}
    </Badge>
  );
}
