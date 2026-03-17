import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Panel — standard surface container with full anatomy
// Prefer Panel over raw Card for product UI.
// ---------------------------------------------------------------------------

interface PanelProps {
  children: React.ReactNode;
  className?: string;
}

export function Panel({ children, className }: PanelProps) {
  return (
    <div className={cn("flex flex-col rounded-xl border border-border bg-card", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PanelHeader — title area at the top of a panel
// ---------------------------------------------------------------------------

interface PanelHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelHeader({ children, className }: PanelHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-0", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PanelTitle — primary label for a panel
// ---------------------------------------------------------------------------

interface PanelTitleProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelTitle({ children, className }: PanelTitleProps) {
  return (
    <h3 className={cn("text-sm font-semibold text-foreground tracking-tight", className)}>
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// PanelDescription — supporting text beneath a panel title
// ---------------------------------------------------------------------------

interface PanelDescriptionProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelDescription({ children, className }: PanelDescriptionProps) {
  return <p className={cn("text-xs text-muted-foreground mt-0.5", className)}>{children}</p>;
}

// ---------------------------------------------------------------------------
// PanelToolbar — action bar within a panel (filters, buttons, etc.)
// ---------------------------------------------------------------------------

interface PanelToolbarProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelToolbar({ children, className }: PanelToolbarProps) {
  return (
    <div className={cn("flex items-center gap-2 px-5 py-3 border-b border-border", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PanelContent — main body of a panel
// ---------------------------------------------------------------------------

interface PanelContentProps {
  children: React.ReactNode;
  padded?: boolean;
  className?: string;
}

export function PanelContent({ children, padded = true, className }: PanelContentProps) {
  return (
    <div className={cn("flex-1 flex flex-col", padded && "px-5 py-4", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PanelFooter — bottom of a panel (save buttons, pagination, summary)
// ---------------------------------------------------------------------------

interface PanelFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function PanelFooter({ children, className }: PanelFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 px-5 py-4 border-t border-border",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PanelMeta — convenience grouping for title + description inside PanelHeader
// ---------------------------------------------------------------------------

interface PanelMetaProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

export function PanelMeta({ title, description, className }: PanelMetaProps) {
  return (
    <div className={cn("flex flex-col min-w-0", className)}>
      <PanelTitle>{title}</PanelTitle>
      {description && <PanelDescription>{description}</PanelDescription>}
    </div>
  );
}
