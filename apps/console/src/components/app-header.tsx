"use client";

import { usePageTitle } from "@/components/page-title-context";

export function AppHeader() {
  const { state } = usePageTitle();

  return (
    <header className="h-12 px-6 flex items-center border-b border-border bg-card shrink-0">
      {state.title && (
        <div className="flex items-baseline gap-3">
          <h1 className="text-sm font-semibold text-foreground tracking-tight">
            {state.title}
          </h1>
          {state.description && (
            <p className="text-sm text-muted-foreground">{state.description}</p>
          )}
        </div>
      )}
    </header>
  );
}
