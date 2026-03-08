"use client";

import { useTransition } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface RefreshButtonProps {
  action: () => Promise<void>;
}

export function RefreshButton({ action }: RefreshButtonProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-8 gap-1.5 px-2 text-xs text-muted-foreground"
      disabled={isPending}
      onClick={() => startTransition(() => action())}
    >
      <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
      {isPending ? "Refreshing…" : "Refresh"}
    </Button>
  );
}
