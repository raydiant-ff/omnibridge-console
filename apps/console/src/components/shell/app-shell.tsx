import { cn } from "@/lib/utils";
import { ShellProvider } from "./shell-context";

// ---------------------------------------------------------------------------
// AppShell — root structural container for the entire application
// Provides: sidebar slot, top-bar slot, main content area
// ---------------------------------------------------------------------------

interface AppShellProps {
  sidebar: React.ReactNode;
  topBar?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

export function AppShell({ sidebar, topBar, children, className }: AppShellProps) {
  return (
    <ShellProvider>
      <div className={cn("flex h-screen overflow-hidden bg-background", className)}>
        {/* Left sidebar slot */}
        {sidebar}

        {/* Right of sidebar: top-bar + scrollable main */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
          {topBar}
          <main className="flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </ShellProvider>
  );
}

// ---------------------------------------------------------------------------
// SidebarShell — structural wrapper for sidebar content
// Handles collapsed / expanded width transitions
// ---------------------------------------------------------------------------

interface SidebarShellProps {
  collapsed?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function SidebarShell({ collapsed = false, children, className }: SidebarShellProps) {
  return (
    <aside
      data-collapsed={collapsed}
      className={cn(
        "h-screen shrink-0 flex flex-col border-r border-border bg-card transition-all duration-200",
        collapsed ? "w-[60px]" : "w-[260px]",
        className,
      )}
    >
      {children}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// SidebarNavSection — a labeled group of nav items
// ---------------------------------------------------------------------------

interface SidebarNavSectionProps {
  label?: string;
  children: React.ReactNode;
  className?: string;
}

export function SidebarNavSection({ label, children, className }: SidebarNavSectionProps) {
  return (
    <div className={cn("px-4 py-2", className)}>
      {label && (
        <p className="px-2 mb-1.5 text-xs font-medium text-muted-foreground">
          {label}
        </p>
      )}
      <ul className="space-y-0.5">{children}</ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SidebarFooter — pinned bottom region of sidebar
// ---------------------------------------------------------------------------

interface SidebarFooterProps {
  children: React.ReactNode;
  className?: string;
}

export function SidebarFooter({ children, className }: SidebarFooterProps) {
  return (
    <div className={cn("mt-auto border-t border-border px-4 py-4", className)}>{children}</div>
  );
}

// ---------------------------------------------------------------------------
// TopBar — sticky application-level top bar
// ---------------------------------------------------------------------------

interface TopBarProps {
  children: React.ReactNode;
  className?: string;
}

export function TopBar({ children, className }: TopBarProps) {
  return (
    <header
      className={cn(
        "h-14 shrink-0 flex items-center border-b border-border bg-card px-6 gap-4",
        className,
      )}
    >
      {children}
    </header>
  );
}
