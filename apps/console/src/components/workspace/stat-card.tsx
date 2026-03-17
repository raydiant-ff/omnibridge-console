import { cn } from "@/lib/utils";

interface StatCardProps {
  label: string;
  value?: string | number;
  detail?: string;
  /** "primary" adds a brand-color accent border and title */
  variant?: "default" | "primary";
  className?: string;
  /** When children are provided, they replace the default value/detail layout */
  children?: React.ReactNode;
}

export function StatCard({
  label,
  value,
  detail,
  variant = "default",
  className,
  children,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border bg-card card-shadow",
        variant === "primary"
          ? "border-primary/25"
          : "border-border",
        className,
      )}
    >
      <div className="px-5 pt-5 pb-2">
        <h4
          className={cn(
            "text-xs font-medium text-muted-foreground",
            variant === "primary" && "text-primary",
          )}
        >
          {label}
        </h4>
      </div>
      <div className="px-5 pb-5">
        {children ?? (
          <>
            {value != null && (
              <p className="text-2xl font-semibold text-foreground tabular-nums tracking-tight">
                {typeof value === "number" ? value.toLocaleString() : value}
              </p>
            )}
            {detail && (
              <p className="mt-1 text-sm text-muted-foreground">{detail}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
