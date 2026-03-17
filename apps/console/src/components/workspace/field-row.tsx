import { cn } from "@/lib/utils";

interface FieldRowProps {
  label: string;
  mono?: boolean;
  value?: string | number | null;
  children?: React.ReactNode;
  className?: string;
}

export function FieldRow({
  label,
  mono,
  value,
  children,
  className,
}: FieldRowProps) {
  const content = children ?? (
    value != null && value !== "" ? (
      <span className={cn("text-right", mono && "font-mono")}>{value}</span>
    ) : (
      <span className="text-muted-foreground">—</span>
    )
  );

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4 border-b border-border px-4 py-2.5 last:border-b-0",
        className,
      )}
    >
      <span className="shrink-0 text-sm text-muted-foreground">{label}</span>
      <div className="text-sm">{content}</div>
    </div>
  );
}
