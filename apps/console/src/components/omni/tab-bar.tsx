"use client";

import { cn } from "@/lib/utils";

/**
 * TabBar — horizontal tab strip with bold active indicator.
 * Underline style, no backgrounds on tabs. Clean, fast.
 */
export function TabBar({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: { id: string; label: string; count?: number }[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-0 border-b border-border", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "relative px-4 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap",
            active === tab.id
              ? "text-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          <span className="flex items-center gap-1.5">
            {tab.label}
            {tab.count !== undefined && (
              <span className="text-[11px] tabular-nums text-muted-foreground">{tab.count}</span>
            )}
          </span>
          {active === tab.id && (
            <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground" />
          )}
        </button>
      ))}
    </div>
  );
}
