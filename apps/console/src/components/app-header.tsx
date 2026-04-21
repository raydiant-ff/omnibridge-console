"use client";

import { usePageTitle } from "@/components/page-title-context";

export function AppHeader() {
  const { state } = usePageTitle();

  return (
    <header className="h-16 px-8 flex items-center border-b border-border bg-background/95 shrink-0 backdrop-blur-sm">
      {state.title && (
        <div className="flex items-baseline gap-3.5">
          <h1 className="text-xl font-semibold text-foreground tracking-tight">
            {state.title}
          </h1>
          {state.description && (
            <p className="text-sm text-muted-foreground leading-none">{state.description}</p>
          )}
        </div>
      )}
    </header>
  );
}
