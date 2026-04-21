import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// WorkspaceContainer — outermost page-level container
// Sits inside the main scroll area; governs max-width, padding, layout mode
// ---------------------------------------------------------------------------

interface WorkspaceContainerProps {
  children: React.ReactNode;
  /** "full" = no max-width (operational tables); "contained" = capped width */
  variant?: "full" | "contained" | "narrow";
  className?: string;
}

export function WorkspaceContainer({
  children,
  variant = "full",
  className,
}: WorkspaceContainerProps) {
  return (
    <div
      className={cn(
        "flex flex-col min-h-full",
        variant === "contained" && "max-w-6xl mx-auto w-full",
        variant === "narrow" && "max-w-2xl mx-auto w-full",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceHeader — sticky header region within a workspace page
// ---------------------------------------------------------------------------

interface WorkspaceHeaderProps {
  children: React.ReactNode;
  sticky?: boolean;
  className?: string;
}

export function WorkspaceHeader({ children, sticky = false, className }: WorkspaceHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 px-8 pt-8 pb-6",
        sticky && "sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkspaceBody — scrollable main content area of a workspace
// ---------------------------------------------------------------------------

interface WorkspaceBodyProps {
  children: React.ReactNode;
  className?: string;
}

export function WorkspaceBody({ children, className }: WorkspaceBodyProps) {
  return <div className={cn("flex-1 px-8 pb-8 flex flex-col gap-8", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// PrimaryColumn / SecondaryColumn / TertiaryColumn
// Flexible column layout for multi-column workspace pages
// ---------------------------------------------------------------------------

interface ColumnProps {
  children: React.ReactNode;
  className?: string;
}

export function PrimaryColumn({ children, className }: ColumnProps) {
  return <div className={cn("flex-1 min-w-0 flex flex-col gap-4", className)}>{children}</div>;
}

export function SecondaryColumn({ children, className }: ColumnProps) {
  return (
    <div className={cn("w-80 shrink-0 flex flex-col gap-4", className)}>{children}</div>
  );
}

export function TertiaryColumn({ children, className }: ColumnProps) {
  return (
    <div className={cn("w-64 shrink-0 flex flex-col gap-4", className)}>{children}</div>
  );
}

// ---------------------------------------------------------------------------
// StickyRail — fixed right-side auxiliary rail
// ---------------------------------------------------------------------------

interface StickyRailProps {
  children: React.ReactNode;
  className?: string;
}

export function StickyRail({ children, className }: StickyRailProps) {
  return (
    <aside
      className={cn(
        "w-72 shrink-0 sticky top-0 h-screen overflow-y-auto border-l border-border bg-card flex flex-col",
        className,
      )}
    >
      {children}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// SectionStack — vertical sequence of section-level content blocks
// ---------------------------------------------------------------------------

interface SectionStackProps {
  children: React.ReactNode;
  gap?: "sm" | "md" | "lg";
  className?: string;
}

export function SectionStack({ children, gap = "md", className }: SectionStackProps) {
  return (
    <div
      className={cn(
        "flex flex-col",
        gap === "sm" && "gap-3",
        gap === "md" && "gap-6",
        gap === "lg" && "gap-10",
        className,
      )}
    >
      {children}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SectionBlock — individual section unit; maps to a discrete content area
// ---------------------------------------------------------------------------

interface SectionBlockProps {
  children: React.ReactNode;
  className?: string;
}

export function SectionBlock({ children, className }: SectionBlockProps) {
  return <section className={cn("flex flex-col", className)}>{children}</section>;
}

// ---------------------------------------------------------------------------
// DetailTabsRegion — wraps a tab system used for record detail pages
// ---------------------------------------------------------------------------

interface DetailTabsRegionProps {
  children: React.ReactNode;
  className?: string;
}

export function DetailTabsRegion({ children, className }: DetailTabsRegionProps) {
  return <div className={cn("flex flex-col flex-1 min-h-0", className)}>{children}</div>;
}

// ---------------------------------------------------------------------------
// OverlayContainer — portal-ready mount point for overlays
// (dialogs, sheets, drawers are self-portaling; this is for custom cases)
// ---------------------------------------------------------------------------

interface OverlayContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function OverlayContainer({ children, className }: OverlayContainerProps) {
  return (
    <div className={cn("relative z-50", className)}>{children}</div>
  );
}
