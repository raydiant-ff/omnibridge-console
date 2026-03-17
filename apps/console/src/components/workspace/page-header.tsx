"use client";

import * as React from "react";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { usePageTitle } from "@/components/page-title-context";

interface PageHeaderProps {
  title: string;
  /** Inline subtitle displayed next to the title in brand color */
  subtitle?: string;
  /** Full-width description below the title (existing API) */
  description?: string;
  /** Pipe-separated headline stats below the title */
  stats?: Array<{ label: string; value: string }>;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export function PageHeader({
  title,
  subtitle: _subtitle,
  description,
  stats,
  badge,
  actions,
  className,
  children,
}: PageHeaderProps) {
  const { set } = usePageTitle();

  useEffect(() => {
    set({ title, description });
    return () => set({ title: "" });
  }, [title, description, set]);

  // Only render inline content (actions, stats, badge) — title/description go to header bar
  const hasInlineContent = stats || badge || actions || children;
  if (!hasInlineContent) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      {stats && stats.length > 0 && (
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          {stats.map((stat, index) => (
            <React.Fragment key={stat.label}>
              {index > 0 && <span className="text-border">|</span>}
              <span>
                <span className="font-medium text-foreground">
                  {stat.value}
                </span>{" "}
                {stat.label}
              </span>
            </React.Fragment>
          ))}
        </div>
      )}
      {(actions || children || badge) && (
        <div className="flex shrink-0 items-center gap-2 ml-auto">
          {badge}
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}
