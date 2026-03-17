import { cn } from "@/lib/utils";

/**
 * FilterBar — Horizontal strip for operational filter/action controls.
 *
 * Contains filter selects, search inputs, sort controls, and action buttons.
 * Wraps responsively.
 */

interface FilterBarProps {
  children: React.ReactNode;
  className?: string;
}

export function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-end gap-3", className)}>
      {children}
    </div>
  );
}

/**
 * FilterField — Labeled filter control within a FilterBar.
 */
export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
