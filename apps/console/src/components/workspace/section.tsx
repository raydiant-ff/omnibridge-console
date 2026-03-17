import { cn } from "@/lib/utils";
import { cva, type VariantProps } from "class-variance-authority";

// ============================================================================
// Section — simple titled card for detail pages (existing API, unchanged)
// ============================================================================

interface SectionProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  className?: string;
}

export function Section({
  title,
  count,
  children,
  collapsible,
  defaultOpen = true,
  className,
}: SectionProps) {
  const header = (
    <div
      className={cn(
        "border-b border-border bg-transparent px-6 py-4",
        collapsible && "cursor-pointer select-none hover:text-foreground",
      )}
    >
      <h3 className="text-base font-semibold text-foreground">
        {title}
        {count != null && (
          <span className="ml-2 font-normal text-muted-foreground">
            ({count})
          </span>
        )}
      </h3>
    </div>
  );

  if (collapsible) {
    return (
      <details
        open={defaultOpen}
        className={cn("rounded-2xl border border-border card-shadow", className)}
      >
        <summary className="list-none [&::-webkit-details-marker]:hidden">
          {header}
        </summary>
        <div>{children}</div>
      </details>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-border card-shadow", className)}>
      {header}
      <div>{children}</div>
    </div>
  );
}

// ============================================================================
// CommandSection — priority-based card for command-center layouts
// ============================================================================

const commandSectionVariants = cva("rounded-2xl border bg-card overflow-hidden card-shadow", {
  variants: {
    priority: {
      critical:
        "border-destructive/30 border-l-[3px] border-l-destructive/70",
      high: "border-border border-l-[3px] border-l-warning/50",
      medium: "border-border border-l-[3px] border-l-border",
      low: "border-border border-l-[3px] border-l-success/40",
    },
  },
  defaultVariants: {
    priority: "medium",
  },
});

const iconVariants = cva(
  "flex shrink-0 items-center justify-center rounded-xl",
  {
    variants: {
      iconVariant: {
        default: "bg-muted/50 text-muted-foreground",
        danger: "bg-destructive/10 text-destructive",
        warning: "bg-warning/10 text-warning",
        success: "bg-success/10 text-success",
        primary: "bg-primary/10 text-primary",
      },
    },
    defaultVariants: {
      iconVariant: "default",
    },
  },
);

interface CommandSectionProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof commandSectionVariants> {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  iconVariant?: VariantProps<typeof iconVariants>["iconVariant"];
  badge?: string | number;
  action?: React.ReactNode;
}

export function CommandSection({
  title,
  subtitle,
  icon,
  iconVariant: iconV,
  badge,
  action,
  priority,
  className,
  children,
  ...props
}: CommandSectionProps) {
  const titleClasses = {
    critical: "text-base font-semibold text-foreground",
    high: "text-base font-semibold text-foreground",
    medium: "text-base font-semibold text-foreground",
    low: "text-base font-semibold text-foreground",
  }[priority ?? "medium"];

  const subtitleClasses = {
    critical: "text-sm text-destructive",
    high: "text-sm text-warning",
    medium: "text-sm text-muted-foreground",
    low: "text-sm text-muted-foreground",
  }[priority ?? "medium"];

  const iconSize = "p-2.5";
  const isCompact = false;

  return (
    <div
      className={cn(commandSectionVariants({ priority }), className)}
      {...props}
    >
      <div
        className="flex items-center justify-between gap-4 px-6 pt-5 pb-3"
      >
        <div className="flex items-center gap-3">
          {icon && (
            <div className={cn(iconVariants({ iconVariant: iconV }), iconSize)}>
              {icon}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h3 className={titleClasses}>{title}</h3>
              {badge !== undefined && (
                <span className="px-2 py-1 text-xs font-medium bg-muted text-muted-foreground rounded-full">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className={subtitleClasses}>{subtitle}</p>}
          </div>
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </div>
      <div className="px-6 pb-5 pt-1">
        {children}
      </div>
    </div>
  );
}
