import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// PageViewport — full-height page container with consistent padding
// ---------------------------------------------------------------------------

interface PageViewportProps {
  children: React.ReactNode;
  padded?: boolean;
  className?: string;
}

export function PageViewport({ children, padded = true, className }: PageViewportProps) {
  return (
    <div className={cn("flex flex-col min-h-full", padded && "px-8 py-8", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageHeader — structural page title area
// ---------------------------------------------------------------------------

interface PageHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export function PageHeader({ children, className }: PageHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-6", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageHeaderMeta — left side of page header (title + subtitle)
// ---------------------------------------------------------------------------

interface PageHeaderMetaProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}

export function PageHeaderMeta({ title, description, className }: PageHeaderMetaProps) {
  return (
    <div className={cn("flex flex-col gap-0.5 min-w-0", className)}>
      <h1 className="text-xl font-semibold text-foreground tracking-tight">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageActions — right side of page header (buttons, controls)
// ---------------------------------------------------------------------------

interface PageActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function PageActions({ children, className }: PageActionsProps) {
  return (
    <div className={cn("flex items-center gap-2 shrink-0", className)}>{children}</div>
  );
}

// ---------------------------------------------------------------------------
// PageSection — a discrete vertical section within a page
// ---------------------------------------------------------------------------

interface PageSectionProps {
  children: React.ReactNode;
  className?: string;
}

export function PageSection({ children, className }: PageSectionProps) {
  return <section className={cn("flex flex-col", className)}>{children}</section>;
}

// ---------------------------------------------------------------------------
// PageSectionHeader — label area for a page section
// ---------------------------------------------------------------------------

interface PageSectionHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function PageSectionHeader({
  title,
  description,
  actions,
  className,
}: PageSectionHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 mb-4", className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-foreground">{title}</h2>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PageSectionBody — content area for a page section
// ---------------------------------------------------------------------------

interface PageSectionBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function PageSectionBody({ children, className }: PageSectionBodyProps) {
  return <div className={cn("flex flex-col", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// SplitLayout — two-pane horizontal layout
// ---------------------------------------------------------------------------

interface SplitLayoutProps {
  children: React.ReactNode;
  /** Ratio applied to first child: "1/3" | "1/2" (default) | "2/3" */
  split?: "1/3" | "1/2" | "2/3";
  gap?: "sm" | "md" | "lg";
  className?: string;
}

export function SplitLayout({ children, split = "1/2", gap = "md", className }: SplitLayoutProps) {
  return (
    <div
      className={cn(
        "flex min-h-0",
        gap === "sm" && "gap-4",
        gap === "md" && "gap-6",
        gap === "lg" && "gap-8",
        className,
      )}
      data-split={split}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RailLayout — main content + optional sticky right rail
// ---------------------------------------------------------------------------

interface RailLayoutProps {
  children: React.ReactNode;
  rail: React.ReactNode;
  className?: string;
}

export function RailLayout({ children, rail, className }: RailLayoutProps) {
  return (
    <div className={cn("flex min-h-0 gap-6", className)}>
      <div className="flex-1 min-w-0 flex flex-col">{children}</div>
      {rail}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stack — vertical flex stack
// ---------------------------------------------------------------------------

interface StackProps {
  children: React.ReactNode;
  gap?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
}

export function Stack({ children, gap = "md", className }: StackProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        gap === "xs" && "gap-1",
        gap === "sm" && "gap-2",
        gap === "md" && "gap-4",
        gap === "lg" && "gap-6",
        gap === "xl" && "gap-8",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline — horizontal flex row, wraps by default
// ---------------------------------------------------------------------------

interface InlineProps {
  children: React.ReactNode;
  gap?: "xs" | "sm" | "md" | "lg";
  align?: "start" | "center" | "end" | "baseline";
  wrap?: boolean;
  className?: string;
}

export function Inline({
  children,
  gap = "sm",
  align = "center",
  wrap = true,
  className,
}: InlineProps) {
  return (
    <div
      className={cn(
        "flex",
        wrap && "flex-wrap",
        align === "start" && "items-start",
        align === "center" && "items-center",
        align === "end" && "items-end",
        align === "baseline" && "items-baseline",
        gap === "xs" && "gap-1",
        gap === "sm" && "gap-2",
        gap === "md" && "gap-3",
        gap === "lg" && "gap-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// InsetPanel — padded inset surface inside a panel or page section
// ---------------------------------------------------------------------------

interface InsetPanelProps {
  children: React.ReactNode;
  className?: string;
}

export function InsetPanel({ children, className }: InsetPanelProps) {
  return (
    <div className={cn("rounded-lg bg-muted/40 border border-border px-4 py-3", className)}>
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// StickyPanel — a panel that sticks to the top of its scroll container
// ---------------------------------------------------------------------------

interface StickyPanelProps {
  children: React.ReactNode;
  offset?: number;
  className?: string;
}

export function StickyPanel({ children, offset = 0, className }: StickyPanelProps) {
  return (
    <div
      className={cn("sticky z-10", className)}
      style={{ top: offset }}
    >
      {children}
    </div>
  );
}
