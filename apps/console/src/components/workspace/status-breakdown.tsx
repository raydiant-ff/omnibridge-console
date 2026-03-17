import { cn } from "@/lib/utils";

interface StatusBreakdownItemProps {
  label: string;
  value: string | number;
  color: "green" | "red" | "orange";
}

export function StatusBreakdownItem({
  label,
  value,
  color,
}: StatusBreakdownItemProps) {
  const dotColor = {
    green: "bg-success",
    red: "bg-destructive",
    orange: "bg-warning",
  }[color];

  const valueColor = {
    green: "text-success font-semibold",
    red: "text-destructive font-semibold",
    orange: "text-foreground font-medium",
  }[color];

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2.5">
        <span className={cn("size-1.5 rounded-full", dotColor)} />
        <span className="text-sm text-foreground/60">{label}</span>
      </div>
      <span className={cn("text-sm font-semibold tabular-nums", valueColor)}>
        {value}
      </span>
    </div>
  );
}
