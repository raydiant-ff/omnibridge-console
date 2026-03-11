"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

interface DryRunLogPanelProps {
  logs: string[];
  defaultExpanded?: boolean;
  maxHeight?: string;
}

export function DryRunLogPanel({
  logs,
  defaultExpanded = true,
  maxHeight = "max-h-80",
}: DryRunLogPanelProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (logs.length === 0) return null;

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-amber-700 dark:text-amber-400">
          Dry Run Results ({logs.length} entries)
        </span>
        {expanded ? (
          <ChevronDown className="size-4 text-amber-600" />
        ) : (
          <ChevronRight className="size-4 text-amber-600" />
        )}
      </button>
      {expanded && (
        <div className={`${maxHeight} overflow-y-auto border-t border-amber-500/20 px-4 py-3`}>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed text-amber-900 dark:text-amber-200">
            {logs.join("\n")}
          </pre>
        </div>
      )}
    </div>
  );
}
