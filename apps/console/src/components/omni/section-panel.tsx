import { cn } from "@/lib/utils";

/**
 * SectionPanel — the primary content container for Omni.
 * Sharp borders, no shadows, no rounded corners on inner sections.
 * Stripe-admin bold: high contrast, crisp, dense.
 */
export function SectionPanel({
  title,
  count,
  action,
  children,
  className,
  noPadding,
}: {
  title?: string;
  count?: number;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}) {
  return (
    <div className={cn("border border-border bg-card", className)}>
      {title && (
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <h3 className="text-[13px] font-semibold text-foreground tracking-tight">{title}</h3>
            {count !== undefined && (
              <span className="text-[12px] text-muted-foreground tabular-nums">{count}</span>
            )}
          </div>
          {action && <div>{action}</div>}
        </div>
      )}
      <div className={cn(!noPadding && "p-5")}>
        {children}
      </div>
    </div>
  );
}
