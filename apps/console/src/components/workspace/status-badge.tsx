import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
  {
    variants: {
      variant: {
        active: "bg-success/20 text-success",
        pending: "bg-warning/20 text-warning",
        danger: "bg-destructive/20 text-destructive",
        default: "bg-muted text-muted-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  withDot?: boolean;
}

export function StatusBadge({
  variant,
  withDot = false,
  className,
  children,
  ...props
}: StatusBadgeProps) {
  const dotColor = {
    active: "bg-success",
    pending: "bg-warning",
    danger: "bg-destructive",
    default: "bg-muted-foreground",
  }[variant ?? "default"];

  return (
    <span
      className={cn(statusBadgeVariants({ variant }), className)}
      {...props}
    >
      {withDot && (
        <span className={cn("size-1.5 rounded-full", dotColor)} />
      )}
      {children}
    </span>
  );
}
